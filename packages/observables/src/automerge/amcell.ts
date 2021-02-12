// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JSONObject } from '@lumino/coreutils';

import { Message } from '@lumino/messaging';

import { AutomergeModelDB } from './ammodeldb';

import { IObservableJSON } from './../observablejson';

import { IObservableCell } from './../observablecell';

import { IObservableCodeEditor } from './../observablecodeeditor';

import { IObservableValue } from './../observablevalue';

import { AutomergeJSON } from './amjson';

import { AutomergeCodeEditor } from './amcodeeditor';

import { AutomergeValue } from './amvalue';

/**
 * A concrete Automerge map for Cell data.
 */
export class AutomergeCell extends AutomergeJSON {
  /**
   * Construct a new Automerge Cell object.
   */
  constructor(
    path: string[],
    modelDB: AutomergeModelDB,
    id: string,
    options: AutomergeJSON.IOptions = {}
  ) {
    super(path, modelDB, { values: options.values });
    this._id = id;
    console.log('--- amcell new', path, this._id);
    this._codeEditor = new AutomergeCodeEditor(path.concat('codeEditor'), modelDB);
    this._metadata = new AutomergeJSON(path.concat('metadata'), modelDB);
    this._cellType = new AutomergeValue(path.concat('cell_type'), modelDB, 'code');
    this._trusted = new AutomergeValue(path.concat('trusted'), modelDB, false);
    this._executionCount =  new AutomergeValue(path.concat('execution_count'), modelDB, '');
  }

  public initObservables() {
    super.initObservables();
    this._codeEditor.initObservables();
    this._metadata.initObservables();
    this._cellType.initObservables();
    this._trusted.initObservables();
    this._executionCount.initObservables();
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
