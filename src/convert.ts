import {$on, $off, IOculusHandler, IOculusWatcher, observing, IObservable, IOculusUnwatcher} from "./oculusx";

export function convert(target:any):IObservable {
  if (observing.has(<IObservable>target)) return <IObservable>target;

  const observers = new Map<string, Set<Function>>();
  const values: any = {};

  const unobserve: IOculusUnwatcher = function unobserve(path:string): IOculusUnwatcher {
    const chain = path.split('.');
    const [prop,] = chain;
    const set = observers.get(path);
    if (set) {
      set.clear();
      const nextInChain = target[prop];
      if (typeof nextInChain === 'object' || observing.has(nextInChain)) {
        nextInChain[$off](chain.slice(1));
      }
      observers.delete(path);
    }
    return target[$off];
  };

  const observe: IOculusWatcher = function observe(path:string, handler: IOculusHandler, invoke = false): IOculusWatcher {
    const chain = path.split('.');
    const [prop,] = chain;
    const isNew = !observers.has(prop);

    const callback: any = function () {
      // @ts-ignore
      return handler(...arguments);
    };
    callback['oculusx-origin'] = handler;

    let callbacks = observers.get(path);
    if (!callbacks) {
      callbacks = new Set<Function>();
      observers.set(path, callbacks);
    }
    callbacks.add(callback);

    if (isNew) {
      const initialValue = target[prop];
      if (typeof initialValue === 'object') {
        convert(initialValue);
        Array.from(observers.entries()).forEach(([path, set]) => {
          if (path.startsWith(prop + '.')) {
            set.forEach(cb => initialValue[$on](path.split('.').slice(1).join('.'), cb));
          }
        })
      }
      values[prop] = initialValue;
      typeof target === 'object' && Object.defineProperty(target, prop, {
        get() {
          return values[prop]
        },
        set(v) {
          values[prop] = v;
          const set = observers.get(prop);
          set && set.forEach(cb => cb(v, prop));
          if (typeof v === 'object') {
            convert(v);
            Array.from(observers.entries()).forEach(([path, set]) => {
              if (path.startsWith(prop + '.')) {
                const nextProp = path.split('.')[1];
                set.forEach(cb => v[$on](path.split('.').slice(1).join('.'), () => cb(v[nextProp], nextProp), true));
              }
            })
          }
        },
        configurable: true
      });
    }

    if (invoke) {
      const set = observers.get(prop);
      set && set.forEach(cb => cb(values[path]));
    }

    return <IOculusWatcher>target[$on];
  };

  Object.defineProperty(target, $on, {
    value: observe,
    enumerable: false
  });

  Object.defineProperty(target, $off, {
    value: unobserve,
    enumerable: false
  });

  observing.add(target);
  return target;
}