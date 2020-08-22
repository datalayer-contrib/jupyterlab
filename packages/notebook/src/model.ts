// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { showDialog, Dialog } from '@jupyterlab/apputils';

import { DatastoreExt } from '@jupyterlab/datastore';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import {
  CellData,
  CodeCellData,
  ICellData,
  RawCellData,
  MarkdownCellData
} from '@jupyterlab/cells';

import * as nbformat from '@jupyterlab/nbformat';

import { IOutputData, OutputData } from '@jupyterlab/rendermime';

import { ReadonlyJSONObject, UUID } from '@lumino/coreutils';

import { Datastore } from '@lumino/datastore';

import { ISignal, Signal } from '@lumino/signaling';

import { INotebookData, NotebookData } from './data';

import {
  ITranslator
  //  TranslationBundle
} from '@jupyterlab/translation';

/**
 * The definition of a model object for a notebook widget.
 */
export interface INotebookModel extends DocumentRegistry.IModel {
  /**
   * The cell model factory for the notebook.
   */
  readonly contentFactory: NotebookModel.IContentFactory;

  /**
   * The major version number of the nbformat.
   */
  readonly nbformat: number;

  /**
   * The minor version number of the nbformat.
   */
  readonly nbformatMinor: number;

  /**
   * The metadata associated with the notebook.
   */
  readonly metadata: ReadonlyJSONObject;

  /**
   * The location of the notebook data in a datastore.
   */
  readonly data: INotebookData.DataLocation;

  /**
   * The array of deleted cells since the notebook was last run.
   */
  readonly deletedCells: string[];
}

/**
 * An implementation of a notebook Model.
 */
export class NotebookModel implements INotebookModel {
  /**
   * Construct a new notebook model.
   */
  constructor(options: NotebookModel.IOptions = {}) {
    const factory =
      options.contentFactory || NotebookModel.defaultContentFactory;
    if (!options.data) {
      const datastore = (this._store = NotebookData.createStore());
      this.data = {
        datastore,
        record: {
          schema: NotebookData.SCHEMA,
          record: 'data'
        },
        cells: {
          schema: CellData.SCHEMA
        },
        outputs: {
          schema: OutputData.SCHEMA
        }
      };
    } else {
      this.data = options.data;
    }
    if (!options.data) {
      const datastore = (this._store = NotebookData.createStore());
      this.data = {
        datastore,
        record: {
          schema: NotebookData.SCHEMA,
          record: 'data'
        },
        cells: {
          schema: CellData.SCHEMA
        },
        outputs: {
          schema: OutputData.SCHEMA
        }
      };
    } else {
      this.data = options.data;
    }
    const { datastore, record } = this.data;
    if (!DatastoreExt.getRecord(datastore, record)) {
      this.isPrepopulated = false;
      // Handle initialization of data.
      DatastoreExt.withTransaction(datastore, () => {
        DatastoreExt.updateRecord(datastore, record, {
          nbformat: nbformat.MAJOR_VERSION,
          nbformatMinor: nbformat.MINOR_VERSION
        });
        this._ensureMetadata();
      });
    } else {
      this.isPrepopulated = true;
    }

    // Get a content factory that will create new content in the notebook
    // data location.
    this.contentFactory = factory.clone(this.data);

    // Trigger a content change when appropriate.
    datastore.changed.connect(this._onGenericChange, this);
    this._deletedCells = [];
  }

  /**
   * The cell model factory for the notebook.
   */
  readonly contentFactory: NotebookModel.IContentFactory;

  /**
   * The location of the data in the notebook.
   */
  readonly data: INotebookData.DataLocation;

  /**
   * Whether the notebook model is collaborative.
   */
  readonly isCollaborative = true;

  /**
   * Whether the notebook model comes prepopulated.
   */
  readonly isPrepopulated: boolean;

  /**
   * The metadata associated with the notebook.
   */
  get metadata(): ReadonlyJSONObject {
    const { datastore, record } = this.data;
    return DatastoreExt.getField(datastore, { ...record, field: 'metadata' });
  }

  /**
   * The major version number of the nbformat.
   */
  get nbformat(): number {
    const { datastore, record } = this.data;
    return DatastoreExt.getField(datastore, { ...record, field: 'nbformat' });
  }

  /**
   * The minor version number of the nbformat.
   */
  get nbformatMinor(): number {
    const { datastore, record } = this.data;
    return DatastoreExt.getField(datastore, {
      ...record,
      field: 'nbformatMinor'
    });
  }

  /**
   * The default kernel name of the document.
   */
  get defaultKernelName(): string {
    let spec = this.metadata['kernelspec'] as nbformat.IKernelspecMetadata;
    return spec ? spec.name : '';
  }

  /**
   * A list of deleted cells for the notebook..
   */
  get deletedCells(): string[] {
    return this._deletedCells;
  }

  /**
   * A signal emitted when the document content changes.
   */
  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  /**
   * The default kernel name of the document.
   *
   * #### Notes
   * This is a read-only property.
   */
  // TODO(RTC)

  /**
   * The default kernel language of the document.
   */
  get defaultKernelLanguage(): string {
    const info = this.metadata[
      'language_info'
    ] as nbformat.ILanguageInfoMetadata;
    return info ? info.name : '';
  }

  /**
   * Whether the model has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the model.
   */
  dispose(): void {
    // Do nothing if already disposed.
    if (this.isDisposed) {
      return;
    }
    if (this._store) {
      this._store.dispose();
      this._store = null;
    }
  }

  /**
   * Serialize the model to a string.
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Deserialize the model from a string.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  fromString(value: string): void {
    this._contentChanged.emit();
  }

  /**
   * Serialize the model to JSON.
   */
  toJSON(): nbformat.INotebookContent {
    let cellsJSON: nbformat.ICell[] = [];
    let { datastore, record, cells, outputs } = this.data;
    let data = DatastoreExt.getRecord(datastore, record);
    for (let i = 0; i < data!.cells.length; i++) {
      let cell = CellData.toJSON({
        datastore,
        record: { ...cells, record: data!.cells[i] },
        outputs
      });
      cellsJSON.push(cell);
    }
    this._ensureMetadata();
    const metadata = Object.create(null) as nbformat.INotebookMetadata;
    for (let key of Object.keys(this.metadata)) {
      metadata[key] = JSON.parse(JSON.stringify(this.metadata[key]));
    }
    return {
      metadata,
      nbformat_minor: data!.nbformatMinor,
      nbformat: data!.nbformat,
      cells: cellsJSON
    };
  }

  /**
   * Deserialize the model from JSON.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  fromJSON(value: nbformat.INotebookContent): void {
    let { datastore, record, cells, outputs } = this.data;
    DatastoreExt.withTransaction(datastore, () => {
      const cellIds: string[] = [];
      for (let cell of value.cells) {
        const id = UUID.uuid4();
        cellIds.push(id);
        const loc = {
          datastore,
          record: { ...cells, record: id },
          outputs
        };
        switch (cell.cell_type) {
          case 'code':
            CodeCellData.fromJSON(loc, cell as nbformat.ICodeCell);
            break;
          case 'markdown':
            MarkdownCellData.fromJSON(loc, cell as nbformat.IMarkdownCell);
            break;
          case 'raw':
            RawCellData.fromJSON(loc, cell as nbformat.IRawCell);
            break;
          default:
            continue;
        }
      }

      const cellLoc: DatastoreExt.FieldLocation<
        INotebookData.Schema,
        'cells'
      > = { ...record, field: 'cells' };
      const oldCells = DatastoreExt.getField(datastore, cellLoc);
      DatastoreExt.updateField(datastore, cellLoc, {
        index: 0,
        remove: oldCells.length,
        values: cellIds
      });
      oldCells.forEach(cell =>
        CellData.clear({
          datastore,
          outputs: this.data.outputs,
          record: { ...this.data.cells, record: cell }
        })
      );

      let newValue = 0;
      const origNbformat = value.metadata.orig_nbformat;

      if (value.nbformat !== nbformat.MAJOR_VERSION) {
        newValue = value.nbformat;
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'nbformat' },
          newValue
        );
      }
      if (value.nbformat_minor > nbformat.MINOR_VERSION) {
        newValue = value.nbformat_minor;
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'nbformatMinor' },
          newValue
        );
      }

      // Alert the user if the format changes.
      if (origNbformat !== undefined && newValue !== origNbformat) {
        const newer = newValue > origNbformat;
        const msg = `This notebook has been converted from ${
          newer ? 'an older' : 'a newer'
        } notebook format (v${origNbformat}) to the current notebook format (v${newValue}). The next time you save this notebook, the current notebook format (v${newValue}) will be used. ${
          newer
            ? 'Older versions of Jupyter may not be able to read the new format.'
            : 'Some features of the original notebook may not be available.'
        }  To preserve the original format version, close the notebook without saving it.`;
        void showDialog({
          title: 'Notebook converted',
          body: msg,
          buttons: [Dialog.okButton()]
        });
      }

      // Update the metadata.
      let metadata = { ...value.metadata };
      // orig_nbformat is not intended to be stored per spec.
      delete metadata['orig_nbformat'];
      let oldMetadata = { ...this.metadata };
      for (let key in oldMetadata) {
        oldMetadata[key] = null;
      }
      let update = { ...oldMetadata, ...metadata };
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'metadata' },
        update as ReadonlyJSONObject
      );
      this._ensureMetadata();
    });
  }

  /**
   * Initialize the model with its current state.
   *
   * # Notes
   * Adds an empty code cell if the model is empty
   * and clears undo state.
   */
  initialize(): void {
    /* No-op */
  }

  /**
   * Make sure we have the required metadata fields.
   */
  private _ensureMetadata(): void {
    const { datastore, record } = this.data;
    DatastoreExt.withTransaction(datastore, () => {
      let metadata = { ...this.metadata };
      metadata['language_info'] = metadata['language_info'] || { name: '' };
      metadata['kernelspec'] = metadata['kernelspec'] || {
        name: '',
        display_name: ''
      };
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'metadata' },
        metadata
      );
    });
  }

  private _onGenericChange(
    sender: Datastore,
    args: Datastore.IChangedArgs
  ): void {
    const change = args.change;
    // Grab the changes for the schemas we are interested in.
    const recordChange = change[this.data.record.schema.id];
    const cellChange = change[this.data.cells.schema.id];
    const outputChange = change[this.data.outputs.schema.id];
    // If there was a change to any of the top-level items, emit a
    // contentChanged signal.
    if (recordChange) {
      this._contentChanged.emit();
      return;
    }
    // If there were any changes to the outputs, emit a contentChanged signal.
    // TODO: maybe filter for outputs that are definitely in a current cell.
    if (outputChange) {
      this._contentChanged.emit();
      return;
    }

    // Check the cells for changes, ignoring cursors and mimetype.
    const { datastore, record } = this.data;
    const cells = DatastoreExt.getField(datastore, {
      ...record,
      field: 'cells'
    });
    // Check the cell changes to see if some should be considered content.
    if (
      Object.keys(cellChange).some(cell => {
        return (
          // Only count cells that are currently in the notebook.
          cells.indexOf(cell) !== -1 &&
          Object.keys(cellChange[cell]).some(field => {
            // Only count fields that are content fields.
            return Private.CELL_CONTENT_FIELDS.indexOf(field) !== -1;
          })
        );
      })
    ) {
      this._contentChanged.emit();
      return;
    }
  }

  //  private _trans: TranslationBundle;
  private _deletedCells: string[];
  private _store: Datastore | null = null;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
}

/**
 * The namespace for the `NotebookModel` class statics.
 */
export namespace NotebookModel {
  /**
   * An options object for initializing a notebook model.
   */
  export interface IOptions {
    /**
     * The language preference for the model.
     */
    languagePreference?: string;

    /**
     * A factory for creating cell models.
     *
     * The default is a shared factory instance.
     */
    contentFactory?: IContentFactory;

    /**
     * A modelDB for storing notebook data.
     */
    data?: INotebookData.DataLocation;

    /**
     * Language translator.
     */
    translator?: ITranslator;
  }

  /**
   * A factory for creating notebook model content.
   */
  export interface IContentFactory {
    /**
     * Create a new cell by cell type.
     *
     * @param type:  the type of the cell to create.
     *
     * @param options: the cell creation options.
     *
     * #### Notes
     * This method is intended to be a convenience method to programmaticaly
     * call the other cell creation methods in the factory.
     */
    createCell(type: nbformat.CellType, cell?: nbformat.IBaseCell): string;

    /**
     * Create a new code cell.
     *
     * @param options - The options used to create the cell.
     *
     * @returns A new code cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createCodeCell(cell?: nbformat.ICodeCell): string;

    /**
     * Create a new markdown cell.
     *
     * @param options - The options used to create the cell.
     *
     * @returns A new markdown cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createMarkdownCell(cell?: nbformat.IMarkdownCell): string;

    /**
     * Create a new raw cell.
     *
     * @param options - The options used to create the cell.
     *
     * @returns A new raw cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createRawCell(cell?: nbformat.IRawCell): string;

    /**
     * Clone the content factory with a new IModelDB.
     */
    clone(data: ContentFactory.DataLocation): IContentFactory;
  }

  /**
   * The default implementation of an `IContentFactory`.
   */
  export class ContentFactory {
    /**
     * Create a new cell model factory.
     */
    constructor(options: ContentFactory.IOptions) {
      this._data = options.data!;
    }

    /**
     * Create a new cell by cell type.
     *
     * @param type:  the type of the cell to create.
     *
     * @param options: the cell creation options.
     *
     * #### Notes
     * This method is intended to be a convenience method to programmaticaly
     * call the other cell creation methods in the factory.
     */
    createCell(type: nbformat.CellType, cell?: nbformat.IBaseCell): string {
      switch (type) {
        case 'code':
          return this.createCodeCell(cell as nbformat.ICodeCell);
        case 'markdown':
          return this.createMarkdownCell(cell as nbformat.IMarkdownCell);
        case 'raw':
        default:
          return this.createRawCell(cell as nbformat.IRawCell);
      }
    }

    /**
     * Create a new code cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A cell id.
     */
    createCodeCell(value?: nbformat.ICodeCell): string {
      const id = UUID.uuid4();
      const { datastore, cells, outputs } = this._data;
      const loc = {
        datastore,
        record: { ...cells, record: id },
        outputs
      };
      CodeCellData.fromJSON(loc, value);
      return id;
    }

    /**
     * Create a new markdown cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new markdown cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createMarkdownCell(value?: nbformat.IMarkdownCell): string {
      const id = UUID.uuid4();
      const { datastore, cells, outputs } = this._data;
      const loc = {
        datastore,
        record: { ...cells, record: id },
        outputs
      };
      MarkdownCellData.fromJSON(loc, value);
      return id;
    }

    /**
     * Create a new raw cell.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new raw cell. If a source cell is provided, the
     *   new cell will be initialized with the data from the source.
     */
    createRawCell(value?: nbformat.IRawCell): string {
      const id = UUID.uuid4();
      const { datastore, cells, outputs } = this._data;
      const loc = {
        datastore,
        record: { ...cells, record: id },
        outputs
      };
      RawCellData.fromJSON(loc, value);
      return id;
    }

    /**
     * Clone the content factory with a new data location.
     */
    clone(data: ContentFactory.DataLocation): ContentFactory {
      return new ContentFactory({
        data
      });
    }

    private _data: ContentFactory.DataLocation;
  }

  /**
   * A namespace for the notebook model content factory.
   */
  export namespace ContentFactory {
    /**
     * The options used to initialize a `ContentFactory`.
     */
    export interface IOptions {
      /**
       * The data in which to place new content.
       */
      data?: DataLocation;
    }

    /**
     * Data location for a cell content factory.
     */
    export type DataLocation = DatastoreExt.DataLocation & {
      /**
       * A cell table.
       */
      cells: DatastoreExt.TableLocation<ICellData.Schema>;

      /**
       * An outputs table.
       */
      outputs: DatastoreExt.TableLocation<IOutputData.Schema>;
    };
  }

  /**
   * The default `ContentFactory` instance.
   */
  export const defaultContentFactory = new ContentFactory({});
}

/**
 * A namespace for module private functionality.
 */
namespace Private {
  /**
   * Cell fields for which changes should be considered changes
   * to the notebook content.
   */
  export const CELL_CONTENT_FIELDS = Object.keys(CellData.SCHEMA.fields).filter(
    key => key !== 'mimeType' && key !== 'selections'
  );
}
