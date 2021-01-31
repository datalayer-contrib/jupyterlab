// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { Observable } from 'automerge';

import { IObservableMap } from './observablemap';

import { AMModelDB } from './automergemodeldb';

/**
 * A concrete implementation of IObservbleMap<T>.
 */
export class AutomergeMap<T> implements IObservableMap<T> {
  /**
   * Construct a new observable map.
   */
  constructor(
    ws: WebSocket,
    actorId: string,
    amModelDB: AMModelDB,
    observable: Observable,
    options: AutomergeMap.IOptions<T> = {}
  ) {
    this._ws = ws;
    this._actorId = actorId;
    this._amModelDB = amModelDB;
    this._observable = observable;

    // Observe and handle remote changes.
    this._observable.observe(this._amModelDB, (diff, before, after, local) => {
      if (!local && diff.props && diff.props && diff.props.selections) {
        console.log('--- diff', diff.props.selections);
      }
    });

    // Listen on remote changes.
    this._ws.onmessage = (message: MessageEvent) => {
      if (message.data) {
        const change = new Uint8Array(message.data);
        Automerge.Frontend.setActorId(this._amModelDB, this._actorId);
        this._amModelDB = Automerge.applyChanges(this._amModelDB, [change]);
        console.log('--- map', this._amModelDB.selections[this._actorId]);
      }
    };

    this._itemCmp = options.itemCmp || Private.itemCmp;

    if (options.values) {
      for (const key in options.values) {
        this._amModelDB.selections[key] = options.values[key];
      }
    }
  }

  /**
   * The type of the Observable.
   */
  get type(): 'Map' {
    return 'Map';
  }

  /**
   * A signal emitted when the map has changed.
   */
  get changed(): ISignal<this, IObservableMap.IChangedArgs<T>> {
    return this._changed;
  }

  /**
   * Whether this map has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * The number of key-value pairs in the map.
   */
  get size(): number {
    return this._amModelDB.selections.size;
  }

  /**
   * Set a key-value pair in the map
   *
   * @param key - The key to set.
   *
   * @param value - The value for the key.
   *
   * @returns the old value for the key, or undefined
   *   if that did not exist.
   *
   * @throws if the new value is undefined.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  set(key: string, value: T): T | undefined {
    const oldVal = this._amModelDB.selections[key];
    if (value === undefined) {
      throw Error('Cannot set an undefined value, use remove');
    }
    // Bail if the value does not change.
    const itemCmp = this._itemCmp;
    if (oldVal !== undefined && itemCmp(oldVal, value)) {
      return oldVal;
    }
    this._amModelDB.selections[key] = value;
    this._changed.emit({
      type: oldVal ? 'change' : 'add',
      key: key,
      oldValue: oldVal,
      newValue: value
    });
    return oldVal;
  }

  /**
   * Get a value for a given key.
   *
   * @param key - the key.
   *
   * @returns the value for that key.
   */
  get(key: string): T | undefined {
    return this._amModelDB.selections[key];
  }

  /**
   * Check whether the map has a key.
   *
   * @param key - the key to check.
   *
   * @returns `true` if the map has the key, `false` otherwise.
   */
  has(key: string): boolean {
    return this._amModelDB.selections[key] ? true : false;
  }

  /**
   * Get a list of the keys in the map.
   *
   * @returns - a list of keys.
   */
  keys(): string[] {
    /*
    const keyList: string[] = [];
    this._amModelDB.selections.forEach((v: T, k: string) => {
      keyList.push(k);
    });
    return keyList;
    */
    return this._amModelDB.selections
      ? Object.keys(this._amModelDB.selections)
      : [];
  }

  /**
   * Get a list of the values in the map.
   *
   * @returns - a list of values.
   */
  values(): T[] {
    /*
    const valList: T[] = [];
    this._amModelDB.selections.forEach((v: T, k: string) => {
      valList.push(v);
    });
    return valList;
    */
    return this._amModelDB.selections
      ? Object.values(this._amModelDB.selections)
      : [];
  }

  /**
   * Remove a key from the map
   *
   * @param key - the key to remove.
   *
   * @returns the value of the given key,
   *   or undefined if that does not exist.
   *
   * #### Notes
   * This is a no-op if the value does not change.
   */
  delete(key: string): T | undefined {
    const oldVal = this._amModelDB.selections[key];
    // TODO Fix Me
    const removed = (this._amModelDB.selections[key] = undefined);
    if (removed) {
      this._changed.emit({
        type: 'remove',
        key: key,
        oldValue: oldVal,
        newValue: undefined
      });
    }
    return oldVal;
  }

  /**
   * Set the ObservableMap to an empty map.
   */
  clear(): void {
    // Delete one by one to emit the correct signals.
    const keyList = this.keys();
    for (let i = 0; i < keyList.length; i++) {
      this.delete(keyList[i]);
    }
  }

  /**
   * Dispose of the resources held by the map.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this._amModelDB.selections.clear();
  }

  private _ws: WebSocket;
  private _actorId: string;
  private _amModelDB: AMModelDB;
  private _observable: Observable;
  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableMap.IChangedArgs<T>>(this);
  private _isDisposed = false;
}

/**
 * The namespace for `ObservableMap` class statics.
 */
export namespace AutomergeMap {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions<T> {
    /**
     * An optional initial set of values.
     */
    values?: { [key: string]: T };

    /**
     * The item comparison function for change detection on `set`.
     *
     * If not given, strict `===` equality will be used.
     */
    itemCmp?: (first: T, second: T) => boolean;
  }
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The default strict equality item comparator.
   */
  export function itemCmp(first: any, second: any): boolean {
    return first === second;
  }
}
