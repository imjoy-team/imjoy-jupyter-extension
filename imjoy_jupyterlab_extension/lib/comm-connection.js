/* eslint max-classes-per-file: "off" */
/* eslint no-underscore-dangle: "off" */

function isSerializable(object) {
  return typeof object === 'object' && object && object.toJSON;
}

function isObject(value) {
  return (
    value && typeof value === 'object' && value.constructor === Object
  );
}

// pub_buffers and removeBuffers are taken from
// https://github.com/jupyter-widgets/ipywidgets/blob/master/packages/base/src/utils.ts
// Author: IPython Development Team
// License: BSD
export function putBuffers(state, bufferPaths, buffers) {
  buffers = buffers.map(b => {
    if (b instanceof DataView) {
      return b.buffer;
    }
    return b instanceof ArrayBuffer ? b : b.buffer;
  });
  for (let i = 0; i < bufferPaths.length; i++) {
    const bufferPath = bufferPaths[i];
    // say we want to set state[x][y][z] = buffers[i]
    let obj = state;
    // we first get obj = state[x][y]
    for (let j = 0; j < bufferPath.length - 1; j++) {
      obj = obj[bufferPath[j]];
    }
    // and then set: obj[z] = buffers[i]
    obj[bufferPath[bufferPath.length - 1]] = buffers[i];
  }
}

/**
 * The inverse of putBuffers, return an objects with the new state where all buffers(ArrayBuffer)
 * are removed. If a buffer is a member of an object, that object is cloned, and the key removed. If a buffer
 * is an element of an array, that array is cloned, and the element is set to null.
 * See putBuffers for the meaning of buffer_paths
 * Returns an object with the new state (.state) an array with paths to the buffers (.buffer_paths),
 * and the buffers associated to those paths (.buffers).
 */
export function removeBuffers(state) {
  const buffers = [];
  const bufferPaths = [];
  // if we need to remove an object from a list, we need to clone that list, otherwise we may modify
  // the internal state of the widget model
  // however, we do not want to clone everything, for performance
  function remove(obj, path) {
    if (isSerializable(obj)) {
      // We need to get the JSON form of the object before recursing.
      // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior
      obj = obj.toJSON();
    }
    if (Array.isArray(obj)) {
      let isCloned = false;
      for (let i = 0; i < obj.length; i++) {
        const value = obj[i];
        if (value) {
          if (
            value instanceof ArrayBuffer ||
            ArrayBuffer.isView(value)
          ) {
            if (!isCloned) {
              obj = obj.slice();
              isCloned = true;
            }
            buffers.push(
              ArrayBuffer.isView(value) ? value.buffer : value,
            );
            bufferPaths.push(path.concat([i]));
            // easier to just keep the array, but clear the entry, otherwise we have to think
            // about array length, much easier this way
            obj[i] = null;
          } else {
            const newValue = remove(value, path.concat([i]));
            // only assigned when the value changes, we may serialize objects that don't support assignment
            if (newValue !== value) {
              if (!isCloned) {
                obj = obj.slice();
                isCloned = true;
              }
              obj[i] = newValue;
            }
          }
        }
      }
    } else if (isObject(obj)) {
      // eslint-disable-next-line no-restricted-syntax
      for (const key of Object.keys(obj)) {
        let isCloned = false;
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (value) {
            if (
              value instanceof ArrayBuffer ||
              ArrayBuffer.isView(value)
            ) {
              if (!isCloned) {
                obj = {
                  ...obj,
                };
                isCloned = true;
              }
              buffers.push(
                ArrayBuffer.isView(value) ? value.buffer : value,
              );
              bufferPaths.push(path.concat([key]));
              delete obj[key]; // for objects/dicts we just delete them
            } else {
              const newValue = remove(value, path.concat([key]));
              // only assigned when the value changes, we may serialize objects that don't support assignment
              if (newValue !== value) {
                if (!isCloned) {
                  obj = {
                    ...obj,
                  };
                  isCloned = true;
                }
                obj[key] = newValue;
              }
            }
          }
        }
      }
    }
    return obj;
  }
  const newState = remove(state, []);
  return {
    state: newState,
    buffers,
    buffer_paths: bufferPaths,
  };
}

class MessageEmitter {
  constructor(debug) {
    this._event_handlers = {};
    this._once_handlers = {};
    this._debug = debug;
  }

  emit() {
    throw new Error('emit is not implemented');
  }

  on(event, handler) {
    if (!this._event_handlers[event]) {
      this._event_handlers[event] = [];
    }
    this._event_handlers[event].push(handler);
  }

  once(event, handler) {
    handler.___event_run_once = true;
    this.on(event, handler);
  }

  off(event, handler) {
    if (!event && !handler) {
      // remove all events handlers
      this._event_handlers = {};
    } else if (event && !handler) {
      // remove all hanlders for the event
      if (this._event_handlers[event])
        this._event_handlers[event] = [];
    } else if (this._event_handlers[event]) {
      // remove a specific handler
      const idx = this._event_handlers[event].indexOf(handler);
      if (idx >= 0) {
        this._event_handlers[event].splice(idx, 1);
      }
    }
  }

  _fire(event, data) {
    if (this._event_handlers[event]) {
      let i = this._event_handlers[event].length;
      while (i--) {
        const handler = this._event_handlers[event][i];
        try {
          handler(data);
        } catch (e) {
          console.error(e);
        } finally {
          if (handler.___event_run_once) {
            this._event_handlers[event].splice(i, 1);
          }
        }
      }
    } else if (this._debug) {
      console.warn('unhandled event', event, data);
    }
  }
}

export class Connection extends MessageEmitter {
  constructor(config) {
    super(config && config.debug);
    const comm = config.kernel.createComm('imjoy_rpc');
    comm.open({});
    comm.onMsg = msg => {
      const { data } = msg.content;
      const bufferPaths = data.__buffer_paths__ || [];
      delete data.__buffer_paths__;
      putBuffers(data, bufferPaths, msg.buffers || []);
      if (data.type === 'log' || data.type === 'info') {
        console.log(data.message);
      } else if (data.type === 'error') {
        console.error(data.message);
      } else {
        if (data.peer_id) {
          this._peer_id = data.peer_id;
        }
        this._fire(data.type, data);
      }
    };
    this.comm = comm;
  }

  connect() {}

  disconnect() {}

  emit(data) {
    data.peer_id = this._peer_id;
    const split = removeBuffers(data);
    split.state.__buffer_paths__ = split.buffer_paths;
    this.comm.send(split.state, {}, {}, split.buffers);
  }
}
