// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JSONObject } from '@lumino/coreutils';

import { Message } from '@lumino/messaging';

import { Observable } from 'automerge';

import { AutomergeModelDB } from './ammodeldb';

import { AutomergeJSON } from './amjson';

import { AutomergeValue } from './amvalue';

import { IObservableJSON } from './../observablejson';

import { IObservableCell } from './../observablecell';

import { IObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue } from './../observablevalue';

/**
 * A concrete Observable map for JSON data.
 */
export class AutomergeCell extends AutomergeJSON {
  /**
   * Construct a new observable JSON object.
   */
  constructor(
    path: string,
    modelDB: AutomergeModelDB,
    observable: Observable,
    id: string,
    codeEditor: IObservableCodeEditor,
    options: AutomergeJSON.IOptions = {}
  ) {
    super(
      path, modelDB, observable,
      {
      values: options.values
    });
    this._id = id;
    this._codeEditor = codeEditor;
    const idPath = modelDB.idPath(path);
    this._metadata = new AutomergeJSON(idPath, modelDB, observable);
    this._cellType = new AutomergeValue(idPath, modelDB, observable, '');
    this._trusted = new AutomergeValue(idPath, modelDB, observable, '');
    this._executionCount =  new AutomergeValue(idPath, modelDB, observable, '');
  }

  public initObservables() {
    /* no-op */
  }

  get id(): string {
    return this._id;
  }

  get codeEditor(): IObservableCodeEditor {
    return this._codeEditor;
  }

  get metadata(): IObservableJSON {
    return this._metadata;
  }

  get cellType(): IObservableValue {
    return this._cellType;
  }

  get trusted(): IObservableValue {
    return this._trusted;
  }

  get executionCount(): IObservableValue {
    return this._executionCount;
  }

  private _id: string;
  private _codeEditor: IObservableCodeEditor;
  private _metadata: IObservableJSON;
  private _cellType: IObservableValue;
  private _trusted: IObservableValue;
  private _executionCount: IObservableValue;
}

/**
 * The namespace for ObservableCell static data.
 */
export namespace AutomergeCell {
  /**
   * The options use to initialize an observable JSON object.
   */
  export interface IOptions {
    /**
     * The optional initial value for the object.
     */
    values?: JSONObject;
  }

  /**
   * An observable JSON change message.
   */
  export class ChangeMessage extends Message {
    /**
     * Create a new metadata changed message.
     */
    constructor(type: string, args: IObservableCell.IChangedArgs) {
      super(type);
      this.args = args;
    }

    /**
     * The arguments of the change.
     */
    readonly args: IObservableCell.IChangedArgs;
  }
}
