import { EventEmitter } from 'events';

let emitter;
if (process.env.NODE_ENV === 'development') {
  if (!global._notifEmitter) global._notifEmitter = new EventEmitter();
  emitter = global._notifEmitter;
} else {
  emitter = new EventEmitter();
}
emitter.setMaxListeners(100);
export default emitter;
