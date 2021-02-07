// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDisposable } from '@lumino/disposable';

import { ISignal } from '@lumino/signaling';

import { IObservable } from './modeldb';

import { IObservableJSON } from './observablejson';

/**
 * A notebook which can be observed for changes.
 */
export interface IObservableNotebook extends IDisposable, IObservable {
  type: 'Notebook';
  readonly changed: ISignal<this, IObservableNotebook.IChangedArgs>;
  readonly metadata: IObservableJSON;
  createMetadata(): IObservableJSON;
  dispose(): void;
}

/**
 * The interfaces associated with an IObservableNotebook.
 */
export namespace IObservableNotebook {
  /**
   * The change types which occur on an observable map.
   */
  export type ChangeType =
    /**
     * An entry was added.
     */
    | 'add'

    /**
     * An entry was removed.
     */
    | 'remove'

    /**
     * An entry was changed.
     */
    | 'change';

  /**
   * The changed args object which is emitted by an observable map.
   */
  export interface IChangedArgs {
    /**
     * The type of change undergone by the map.
     */
    type: ChangeType;

    /**
     * The key of the change.
     */
    key: string;

    /**
     * The old value of the change.
     */
    oldValue: any | undefined;

    /**
     * The new value of the change.
     */
    newValue: any | undefined;
  }
}
