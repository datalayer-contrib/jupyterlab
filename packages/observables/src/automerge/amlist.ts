// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt,
  ArrayIterator,
  IIterator,
  IterableOrArrayLike,
  each,
  toArray
} from '@lumino/algorithm';

import { ISignal, Signal } from '@lumino/signaling';

import Automerge, { List } from 'automerge';

import { IObservableList } from '../observablelist';

import { IObservableCell } from '../observablecell';

import { 
  amDocPath, 
  getNested, 
  setNested, 
  waitOnAmDocInit, 
  AutomergeModelDB
} from './ammodeldb';

/**
 * A concrete implementation of [[IObservableList]].
 */
export class AutomergeList<T extends IObservableCell> implements IObservableList<T> {
  /**
   * Construct a new automerge list.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    options: AutomergeList.IOptions<T> = {}
  ) {
    this._path = path;
    this._modelDB = modelDB;
    this._itemCmp = options.itemCmp || Private.itemCmp;
  }

  public initObservables() {
    if (amDocPath(this._modelDB.amDoc, this._path)) {
      /* no-op */
    } else {
      this._modelDB.amDoc = Automerge.change(
        this._modelDB.amDoc,
        `list init`,
        doc => {
          setNested(doc, this._path, new Array());
        }
      );
    }
    // Observe and Handle Remote Changes.
    this._modelDB.observable.observe(
      amDocPath(this._modelDB.amDoc, this._path),
      (diff, before, after, local, changes, path) => {
        console.log('--- amlist observe', path, after)
        if (!local) {
        }
      }
    );
  }

  /**
   * The type of this object.
   */
  get type(): 'List' {
    return 'List';
  }

  /**
   * A signal emitted when the list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<T>> {
    return this._changed;
  }

  /**
   * The length of the list.
   */
  get length(): number {
    return amDocPath(this._modelDB.amDoc, this._path)
      ? (amDocPath(this._modelDB.amDoc, this._path) as List<T>).length
      : 0;
  }

  /**
   * Test whether the list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this.clear();
  }

  /**
   * Create an iterator over the values in the list.
   *
   * @returns A new iterator starting at the front of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  iter(): IIterator<T> {
    return new ArrayIterator(amDocPath(this._modelDB.amDoc, this._path) as List<T>);
  }

  /**
   * Get the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The value at the specified index.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  get(index: number): T {
    return (amDocPath(this._modelDB.amDoc, this._path) as List<T>)[index];
  }

  /**
   * Set the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  set(index: number, value: T): void {
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        const oldValue = (amDocPath(this._modelDB.amDoc, this._path) as List<T>)[index];
        if (value === undefined) {
          throw new Error('Cannot set an undefined item');
        }
        // Bail if the value does not change.
        const itemCmp = this._itemCmp;
        if (itemCmp(oldValue, value)) {
          return;
        }
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list set ${this._path} ${index} ${value}`,
          doc => {
//            setNested(doc, this._path.concat(['0']), value);
            (getNested(doc, this._path) as List<T>)[index] = value;
          }
        );
        this._changed.emit({
          type: 'set',
          oldIndex: index,
          newIndex: index,
          oldValues: [oldValue],
          newValues: [value]
        });
      });
    });
  }

  /**
   * Add a value to the end of the list.
   *
   * @param value - The value to add to the end of the list.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  push(value: T): number {
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list push ${this._path} ${value}`,
          doc => {
//            (getNested(doc, this._path) as List<T>).push(value);
            (getNested(doc, this._path) as List<T>).push(value);
          });
      });
    });
    const num = (amDocPath(this._modelDB.amDoc, this._path) as List<T>).length;
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex: this.length - 1,
      oldValues: [],
      newValues: [value]
    });
    return num;
  }

  /**
   * Insert a value into the list at a specific index.
   *
   * @param index - The index at which to insert the value.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  insert(index: number, value: T): void {
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        const v = this._asCell(value);
        console.log('--- amlist insert', index, v)
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list insert ${this._path} ${index} ${value}`,
          doc => {
            const d1 = getNested(doc, this._path);
            if (!d1) {
              setNested(doc, this._path, []);
            }
            const d2 = getNested(doc, this._path) as List<any>
            console.log('---', d2);
//            ArrayExt.insert(d, index, value);
            d2.insertAt!(index, [v]);
          });
        this._changed.emit({
          type: 'add',
          oldIndex: -1,
          newIndex: index,
          oldValues: [],
          newValues: [value]
        });
      });
    });
  }

  /**
   * Remove the first occurrence of a value from the list.
   *
   * @param value - The value of interest.
   *
   * @returns The index of the removed value, or `-1` if the value
   *   is not contained in the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   */
  removeValue(value: T): number {
    const itemCmp = this._itemCmp;
    const index = ArrayExt.findFirstIndex(
      amDocPath(this._modelDB.amDoc, this._path) as List<T>,
      item => {
        return itemCmp(item, value);
      }
    );
    this.remove(index);
    return index;
  }

  /**
   * Remove and return the value at a specific index.
   *
   * @param index - The index of the value of interest.
   *
   * @returns The value at the specified index, or `undefined` if the
   *   index is out of range.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  remove(index: number): T | undefined {
    let value = undefined;
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list remove ${this._path} ${index}`,
          doc => {
            value = ArrayExt.removeAt(getNested(doc, this._path) as List<T>, index);
          }
        );
      });
    });
    if (value === undefined) {
      return;
    }
    this._changed.emit({
      type: 'remove',
      oldIndex: index,
      newIndex: -1,
      newValues: [],
      oldValues: [value]
    });
    return value;
  }

  /**
   * Remove all values from the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * All current iterators are invalidated.
   */
  clear(): void {
    if (amDocPath(this._modelDB.amDoc, this._path)) {
      waitOnAmDocInit(this._modelDB, () => {
        this._modelDB.withLock(() => {
          const copy = (amDocPath(this._modelDB.amDoc, this._path) as List<T>).slice();
          this._modelDB.amDoc = Automerge.change(
            this._modelDB.amDoc,
            `list clear ${this._path}`,
            doc => {
              setNested(doc, this._path, new Array<T>());
            }
          );
          this._changed.emit({
            type: 'remove',
            oldIndex: 0,
            newIndex: 0,
            newValues: [],
            oldValues: copy
          });
        });
      });
    }
  }

  /**
   * Move a value from one index to another.
   *
   * @parm fromIndex - The index of the element to move.
   *
   * @param toIndex - The index to move the element to.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the lesser of the `fromIndex` and the `toIndex`
   * and beyond are invalidated.
   *
   * #### Undefined Behavior
   * A `fromIndex` or a `toIndex` which is non-integral.
   */
  move(fromIndex: number, toIndex: number): void {
    if (this.length <= 1 || fromIndex === toIndex) {
      return;
    }
    let values = Array<T>();
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list move ${this._path} ${fromIndex} ${toIndex}`,
          doc => {
            values = [(getNested(doc, this._path) as List<T>)[fromIndex]];
            ArrayExt.move(getNested(doc, this._path) as List<T>, fromIndex, toIndex);
          }
        );
        this._changed.emit({
          type: 'move',
          oldIndex: fromIndex,
          newIndex: toIndex,
          oldValues: values,
          newValues: values
        });
      });
    });
  }

  /**
   * Push a set of values to the back of the list.
   *
   * @param values - An iterable or array-like set of values to add.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   */
  pushAll(values: IterableOrArrayLike<T>): number {
    const newIndex = this.length;
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list pushAll ${this._path} ${values}`,
          doc => {
            each(values, value => {
              (getNested(doc, this._path) as List<T>).push(value);
            });
          }
        );
      });
    });
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex,
      oldValues: [],
      newValues: toArray(values)
    });
    return this.length;
  }

  /**
   * Insert a set of items into the list at the specified index.
   *
   * @param index - The index at which to insert the values.
   *
   * @param values - The values to insert at the specified index.
   *
   * #### Complexity.
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior.
   * An `index` which is non-integral.
   */
  insertAll(index: number, values: IterableOrArrayLike<T>): void {
    const newIndex = index;
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list insertAll ${this._path} ${index} ${values}`,
          doc => {
            each(values, value => {
              ArrayExt.insert(getNested(doc, this._path) as List<T>, index++, value);
            });
          }
        );
      });
    });
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex,
      oldValues: [],
      newValues: toArray(values)
    });
  }

  /**
   * Remove a range of items from the list.
   *
   * @param startIndex - The start index of the range to remove (inclusive).
   *
   * @param endIndex - The end index of the range to remove (exclusive).
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing to the first removed value and beyond are invalid.
   *
   * #### Undefined Behavior
   * A `startIndex` or `endIndex` which is non-integral.
   */
  removeRange(startIndex: number, endIndex: number): number {
    const oldValues = (amDocPath(this._modelDB.amDoc, this._path) as List<T>).slice(
      startIndex,
      endIndex
    );
    waitOnAmDocInit(this._modelDB, () => {
      this._modelDB.withLock(() => {
        this._modelDB.amDoc = Automerge.change(
          this._modelDB.amDoc,
          `list removeRange ${this._path} ${startIndex} ${endIndex}`,
          doc => {
            for (let i = startIndex; i < endIndex; i++) {
              ArrayExt.removeAt(getNested(doc, this._path) as List<T>, startIndex);
            }
          }
        );
      });
    });
    this._changed.emit({
      type: 'remove',
      oldIndex: startIndex,
      newIndex: -1,
      oldValues,
      newValues: []
    });
    return this.length;
  }

  private _asCell(observableCell: IObservableCell) {
    return {
      id: observableCell.id,
      cell_type: observableCell.cellType.get() || 'code',
      execution_count: observableCell.executionCount.get() || '',
      metadata: observableCell.metadata.toJSON(),
      outputs: [],
      source: new Text(observableCell.codeEditor.value.text),
    };
  }

  private _path: string[];
  private _modelDB: AutomergeModelDB;
  private _isDisposed = false;
  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableList.IChangedArgs<T>>(this);
}

/**
 * The namespace for `ObservableList` class statics.
 */
export namespace AutomergeList {
  /**
   * The options used to initialize an observable map.
   */
  export interface IOptions<T> {
    /**
     * An optional initial set of values.
     */
    values?: IterableOrArrayLike<T>;

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
   * The default strict equality item cmp.
   */
  export function itemCmp(first: any, second: any): boolean {
    return first === second;
  }
}
