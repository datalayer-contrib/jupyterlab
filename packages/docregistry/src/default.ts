// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Mode } from '@jupyterlab/codemirror';

import { Contents } from '@jupyterlab/services';

import { PartialJSONValue } from '@lumino/coreutils';

import { Schema, Fields } from '@lumino/datastore';

import { IDisposable } from '@lumino/disposable';

import { ISignal, Signal } from '@lumino/signaling';

import { Widget } from '@lumino/widgets';

import { MainAreaWidget } from '@jupyterlab/apputils';

import { CodeEditor } from '@jupyterlab/codeeditor';

import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';

import {
  IModelDB,
  ModelDB,
  IObservableString,
  IObservableMap,
  IObservableValue
} from '@jupyterlab/observables';
  
import { DocumentRegistry, IDocumentWidget } from './index';

/**
 * The default implementation of a document model.
 */
export abstract class DocumentModel implements IDisposable {
  /**
   * Construct a new document model.
   */
  constructor(
    mimeType: string,
    languagePreference?: string,
    modelDB?: IModelDB
  ) {
    this.modelDB = modelDB || new ModelDB();
    this._defaultLang = languagePreference || '';
    let mimeTypeObs = this.modelDB.createValue('mimeType');
    mimeTypeObs.changed.connect(
      this._onMimeTypeChanged,
      this
    );
    this._defaultMimeType = mimeType;
  }

  /**
   * A signal emitted when the document content changes.
   */
  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  /**
   * A signal emitted when the document state changes.
   */
  get stateChanged(): ISignal<this, IChangedArgs<any>> {
    return this._stateChanged;
  }

  /**
   * The dirty state of the document.
   */
  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(newValue: boolean) {
    if (newValue === this._dirty) {
      return;
    }
    const oldValue = this._dirty;
    this._dirty = newValue;
    this.triggerStateChange({ name: 'dirty', oldValue, newValue });
  }

  /**
   * The read only state of the document.
   */
  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(newValue: boolean) {
    if (newValue === this._readOnly) {
      return;
    }
    const oldValue = this._readOnly;
    this._readOnly = newValue;
    this.triggerStateChange({ name: 'readOnly', oldValue, newValue });
  }

  /**
   * The default kernel name of the document.
   *
   * #### Notes
   * This is a read-only property.
   */
  get defaultKernelName(): string {
    return '';
  }

  /**
   * The default kernel language of the document.
   *
   * #### Notes
   * This is a read-only property.
   */
  get defaultKernelLanguage(): string {
    return this._defaultLang;
  }

  /**
   * A signal emitted when a mimetype changes.
   */
  get mimeTypeChanged(): ISignal<this, IChangedArgs<string>> {
    return this._mimeTypeChanged;
  }

  /**
   * A mime type of the model.
   */
  get mimeType(): string {
    return this.modelDB.getValue('mimeType') as string;
  }
  set mimeType(newValue: string) {
    const oldValue = this.mimeType;
    if (oldValue === newValue) {
      return;
    }
    this.modelDB.setValue('mimeType', newValue);
  }

  /**
  * Serialize the model to a string.
   */
  abstract toString(): string;

  /**
   * Deserialize the model from a string.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  abstract fromString(value: string): void;

  /**
   * Serialize the model to JSON.
   */
  abstract toJSON(): PartialJSONValue;

  /**
   * Deserialize the model from JSON.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  abstract fromJSON(value: PartialJSONValue): void;

  /**
   * Initialize the model with its current state.
   */
  initialize(): void {
    const mimeType = this.modelDB.get('mimeType') as IObservableValue;
    mimeType.set(mimeType.get() || this._defaultMimeType || 'text/plain');
  }

  /**
   * Whether the model is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the model.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * The underlying `IModelDB` instance in which model
   * data is stored.
   */
  readonly modelDB: IModelDB;

  /**
   * Trigger a state change signal.
   */
  protected triggerStateChange(args: IChangedArgs<any>): void {
    this._stateChanged.emit(args);
  }

  /**
   * Trigger a content changed signal.
   */
  protected triggerContentChange(): void {
    this._contentChanged.emit(void 0);
    this.dirty = true;
  }

  private _onMimeTypeChanged(
    mimeType: IObservableValue,
    args: IObservableValue.IChangedArgs
  ): void {
    this._mimeTypeChanged.emit({
      name: 'mimeType',
      oldValue: args.oldValue as string,
      newValue: args.newValue as string
    });
  }

  private _defaultLang = '';
  private _dirty = false;
  private _isDisposed = false;
  private _readOnly = false;
  private _defaultMimeType: string;
  private _contentChanged = new Signal<this, void>(this);
  private _mimeTypeChanged = new Signal<this, IChangedArgs<string>>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
}

/**
 *
 */
export class TextModel extends DocumentModel
  implements DocumentRegistry.ICodeModel {
  /**
   *
   */
  constructor(languagePreference?: string, modelDB?: IModelDB) {
    super('text/plain', languagePreference, modelDB);
    let value = this.modelDB.createString('value');
    value.changed.connect(
      this.triggerContentChange,
      this
    );
  }

  /**
   * Get the value of the model.
   */
  get value(): IObservableString {
    return this.modelDB.get('value') as IObservableString;
  }

  /**
   * Get the selections for the model.
   */
  get selections(): IObservableMap<CodeEditor.ITextSelection[]> {
    return this.modelDB.get('selections') as IObservableMap<
      CodeEditor.ITextSelection[]
    >;
  }

  toString(): string {
    return this.value.text || ""
  }

  fromString(value: string): void {
    this.value.text = value;
  }

  toJSON(): PartialJSONValue {
    return JSON.parse(this.value.text || 'null');
  }

  fromJSON(value: PartialJSONValue): void {
    this.fromString(JSON.stringify(value));
  }

  initialize(): void {
    super.initialize();
    const value = this.value;
    value.text = value.text || '';
  }
}

/**
 *
 */
export class Base64Model extends DocumentModel {
  /**
   *
   */
  constructor(languagePreference?: string, modelDB?: IModelDB) {
    super('text/plain', languagePreference, modelDB);
    let value = this.modelDB.createValue('value');
    value.changed.connect(
      this.triggerContentChange,
      this
    );
  }

  /**
   * Get the value of the model.
   */
  get value(): IObservableValue {
    return this.modelDB.get('value') as IObservableValue;
  }

  toString(): string {
    return this.value.get() as string;
  }

  fromString(value: string): void {
    this.value.set(value);
  }

  toJSON(): PartialJSONValue {
    return JSON.parse(this.value.toString() || 'null');
  }

  fromJSON(value: PartialJSONValue): void {
    this.fromString(JSON.stringify(value));
  }

  initialize(): void {
    super.initialize();
    const value = this.value;
    value.set(value.get() || '');
  }
}


/**
 * An implementation of a model factory for text files.
 */
export class TextModelFactory implements DocumentRegistry.CodeModelFactory {
  /**
   * The name of the model type.
   *
   * #### Notes
   * This is a read-only property.
   */
  get name(): string {
    return 'text';
  }

  /**
   * The type of the file.
   *
   * #### Notes
   * This is a read-only property.
   */
  get contentType(): Contents.ContentType {
    return 'file';
  }

  /**
   * The format of the file.
   *
   * This is a read-only property.
   */
  get fileFormat(): Contents.FileFormat {
    return 'text';
  }

  /**
   * Get whether the model factory has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the model factory.
   */
  dispose(): void {
    this._isDisposed = true;
  }

  /**
   * Create a new model.
   *
   * @param languagePreference - An optional kernel language preference.
   *
   * @returns A new document model.
   */
  createNew(
    languagePreference?: string,
    modelDB?: IModelDB
  ): DocumentRegistry.ICodeModel {
    return new TextModel(languagePreference, modelDB);
  }

  /**
   * Get the preferred kernel language given a file path.
   */
  preferredLanguage(path: string): string {
    const mode = Mode.findByFileName(path);
    return mode && mode.mode;
  }

  /**
  * The schemas for the datastore.
  */
  get schemas(): ReadonlyArray<Schema> {
   return [
     {
       id: 'TextModelSchema.v1',
       fields: {
         value: Fields.Text({ description: 'The text value of the model' }),
         mimeType: Fields.String({
           value: 'text/plain',
           description: 'The MIME type of the text'
         }),
         selections: Fields.Map({
           description: 'A map of all text selections for all users'
         })
       }
     }
   ];
 }

  private _isDisposed = false;
}

/**
 * An implementation of a model factory for base64 files.
 */
export class Base64ModelFactory implements DocumentRegistry.ModelFactory {
  /**
   * The name of the model type.
   *
   * #### Notes
   * This is a read-only property.
   */
  get name(): string {
    return 'base64';
  }

  /**
   * The type of the file.
   *
   * #### Notes
   * This is a read-only property.
   */
  get contentType(): Contents.ContentType {
    return 'file';
  }

  /**
   * The format of the file.
   *
   * This is a read-only property.
   */
  get fileFormat(): Contents.FileFormat {
    return 'base64';
  }

  /**
  * Get whether the model factory has been disposed.
  */
 get isDisposed(): boolean {
   return this._isDisposed;
 }

 /**
  * Dispose of the resources held by the model factory.
  */
 dispose(): void {
   this._isDisposed = true;
 }

 /**
  * Create a new model.
  *
  * @param languagePreference - An optional kernel language preference.
  *
  * @returns A new document model.
  */
 createNew(
   languagePreference?: string,
   modelDB?: IModelDB
 ): DocumentRegistry.IModel {
   return new Base64Model(languagePreference, modelDB);
 }

 /**
  * Get the preferred kernel language given a file path.
  */
 preferredLanguage(path: string): string {
   let mode = Mode.findByFileName(path);
   return mode && mode.mode;
 }

 /**
  * The schemas for the datastore.
  */
 get schemas(): ReadonlyArray<Schema> {
   return [
     {
       id: 'Base64ModelSchema.v1',
       fields: {
         value: Fields.String({
           description: 'The value of the model'
         })
       }
     }
   ];
 }

 private _isDisposed = false;
}

/**
 * The default implementation of a widget factory.
 */
export abstract class ABCWidgetFactory<
  T extends IDocumentWidget,
  U extends DocumentRegistry.IModel = DocumentRegistry.IModel
> implements DocumentRegistry.IWidgetFactory<T, U> {
  /**
   * Construct a new `ABCWidgetFactory`.
   */
  constructor(options: DocumentRegistry.IWidgetFactoryOptions<T>) {
    this._name = options.name;
    this._readOnly = options.readOnly === undefined ? false : options.readOnly;
    this._defaultFor = options.defaultFor ? options.defaultFor.slice() : [];
    this._defaultRendered = (options.defaultRendered || []).slice();
    this._fileTypes = options.fileTypes.slice();
    this._modelName = options.modelName || 'text';
    this._preferKernel = !!options.preferKernel;
    this._canStartKernel = !!options.canStartKernel;
    this._shutdownOnClose = !!options.shutdownOnClose;
    this._toolbarFactory = options.toolbarFactory;
  }

  /**
   * A signal emitted when a widget is created.
   */
  get widgetCreated(): ISignal<DocumentRegistry.IWidgetFactory<T, U>, T> {
    return this._widgetCreated;
  }

  /**
   * Get whether the model factory has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the document manager.
   */

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * Whether the widget factory is read only.
   */
  get readOnly(): boolean {
    return this._readOnly;
  }

  /**
   * The name of the widget to display in dialogs.
   */
  get name(): string {
    return this._name;
  }

  /**
   * The file types the widget can view.
   */
  get fileTypes(): string[] {
    return this._fileTypes.slice();
  }

  /**
   * The registered name of the model type used to create the widgets.
   */
  get modelName(): string {
    return this._modelName;
  }

  /**
   * The file types for which the factory should be the default.
   */
  get defaultFor(): string[] {
    return this._defaultFor.slice();
  }

  /**
   * The file types for which the factory should be the default for
   * rendering a document model, if different from editing.
   */
  get defaultRendered(): string[] {
    return this._defaultRendered.slice();
  }

  /**
   * Whether the widgets prefer having a kernel started.
   */
  get preferKernel(): boolean {
    return this._preferKernel;
  }

  /**
   * Whether the widgets can start a kernel when opened.
   */
  get canStartKernel(): boolean {
    return this._canStartKernel;
  }

  /**
   * Whether the kernel should be shutdown when the widget is closed.
   */
  get shutdownOnClose(): boolean {
    return this._shutdownOnClose;
  }
  set shutdownOnClose(value: boolean) {
    this._shutdownOnClose = value;
  }

  /**
   * Create a new widget given a document model and a context.
   *
   * #### Notes
   * It should emit the [widgetCreated] signal with the new widget.
   */
  createNew(context: DocumentRegistry.IContext<U>, source?: T): T {
    // Create the new widget
    const widget = this.createNewWidget(context, source);

    // Add toolbar items
    let items: DocumentRegistry.IToolbarItem[];
    if (this._toolbarFactory) {
      items = this._toolbarFactory(widget);
    } else {
      items = this.defaultToolbarFactory(widget);
    }
    items.forEach(({ name, widget: item }) => {
      widget.toolbar.addItem(name, item);
    });

    // Emit widget created signal
    this._widgetCreated.emit(widget);

    return widget;
  }

  /**
   * Create a widget for a context.
   */
  protected abstract createNewWidget(
    context: DocumentRegistry.IContext<U>,
    source?: T
  ): T;

  /**
   * Default factory for toolbar items to be added after the widget is created.
   */
  protected defaultToolbarFactory(widget: T): DocumentRegistry.IToolbarItem[] {
    return [];
  }

  private _toolbarFactory:
    | ((widget: T) => DocumentRegistry.IToolbarItem[])
    | undefined;
  private _isDisposed = false;
  private _name: string;
  private _readOnly: boolean;
  private _canStartKernel: boolean;
  private _shutdownOnClose: boolean;
  private _preferKernel: boolean;
  private _modelName: string;
  private _fileTypes: string[];
  private _defaultFor: string[];
  private _defaultRendered: string[];
  private _widgetCreated = new Signal<DocumentRegistry.IWidgetFactory<T, U>, T>(
    this
  );
}

/**
 * The class name added to a dirty widget.
 */
const DIRTY_CLASS = 'jp-mod-dirty';

/**
 * A document widget implementation.
 */
export class DocumentWidget<
  T extends Widget = Widget,
  U extends DocumentRegistry.IModel = DocumentRegistry.IModel
> extends MainAreaWidget<T> implements IDocumentWidget<T, U> {
  constructor(options: DocumentWidget.IOptions<T, U>) {
    // Include the context ready promise in the widget reveal promise
    options.reveal = Promise.all([options.reveal, options.context.ready]);
    super(options);

    this.context = options.context;

    // Handle context path changes
    this.context.pathChanged.connect(this._onPathChanged, this);
    this._onPathChanged(this.context, this.context.path);

    // Listen for changes in the dirty state.
    this.context.model.stateChanged.connect(this._onModelStateChanged, this);
    void this.context.ready.then(() => {
      this._handleDirtyState();
    });
  }

  /**
   * Set URI fragment identifier.
   */
  setFragment(fragment: string): void {
    /* no-op */
  }

  /**
   * Handle a path change.
   */
  private _onPathChanged(
    sender: DocumentRegistry.IContext<U>,
    path: string
  ): void {
    this.title.label = PathExt.basename(sender.localPath);
  }

  /**
   * Handle a change to the context model state.
   */
  private _onModelStateChanged(
    sender: DocumentRegistry.IModel,
    args: IChangedArgs<any>
  ): void {
    if (args.name === 'dirty') {
      this._handleDirtyState();
    }
  }

  /**
   * Handle the dirty state of the context model.
   */
  private _handleDirtyState(): void {
    if (this.context.model.dirty) {
      this.title.className += ` ${DIRTY_CLASS}`;
    } else {
      this.title.className = this.title.className.replace(DIRTY_CLASS, '');
    }
  }

  readonly context: DocumentRegistry.IContext<U>;
}

export namespace DocumentWidget {
  export interface IOptions<
    T extends Widget = Widget,
    U extends DocumentRegistry.IModel = DocumentRegistry.IModel
  > extends MainAreaWidget.IOptions<T> {
    context: DocumentRegistry.IContext<U>;
  }

  export interface IOptionsOptionalContent<
    T extends Widget = Widget,
    U extends DocumentRegistry.IModel = DocumentRegistry.IModel
  > extends MainAreaWidget.IOptionsOptionalContent<T> {
    context: DocumentRegistry.IContext<U>;
  }
}
