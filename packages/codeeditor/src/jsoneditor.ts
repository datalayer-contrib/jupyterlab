// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { DatastoreExt } from '@jupyterlab/observables';
import {
  nullTranslator,
  ITranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { checkIcon, undoIcon } from '@jupyterlab/ui-components';

import {
  JSONExt,
  JSONObject,
  JSONValue,
  ReadonlyJSONObject
} from '@lumino/coreutils';

import { Datastore, MapField, Schema } from '@lumino/datastore';

import { IDisposable } from '@lumino/disposable';

import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { CodeEditor } from './editor';

/**
 * The class name added to a JSONEditor instance.
 */
const JSONEDITOR_CLASS = 'jp-JSONEditor';

/**
 * The class name added when the Metadata editor contains invalid JSON.
 */
const ERROR_CLASS = 'jp-mod-error';

/**
 * The class name added to the editor host node.
 */
const HOST_CLASS = 'jp-JSONEditor-host';

/**
 * The class name added to the header area.
 */
const HEADER_CLASS = 'jp-JSONEditor-header';

/**
 * A widget for editing observable JSON.
 */
export class JSONEditor<
  S extends Schema,
  F extends keyof JSONEditor.MapFields<S>
> extends Widget {
  /**
   * Construct a new JSON editor.
   */
  constructor(options: JSONEditor.IOptions) {
    super();
    this.translator = options.translator || nullTranslator;
    this._trans = this.translator.load('jupyterlab');
    this.addClass(JSONEDITOR_CLASS);

    this.headerNode = document.createElement('div');
    this.headerNode.className = HEADER_CLASS;

    this.revertButtonNode = undoIcon.element({
      tag: 'span',
      title: this._trans.__('Revert changes to data')
    });

    this.commitButtonNode = checkIcon.element({
      tag: 'span',
      title: this._trans.__('Commit changes to data'),
      marginLeft: '8px'
    });

    this.editorHostNode = document.createElement('div');
    this.editorHostNode.className = HOST_CLASS;

    this.headerNode.appendChild(this.revertButtonNode);
    this.headerNode.appendChild(this.commitButtonNode);

    this.node.appendChild(this.headerNode);
    this.node.appendChild(this.editorHostNode);

    const model = new CodeEditor.Model();

    model.value = this._trans.__('No data!');
    model.mimeType = 'application/json';
    DatastoreExt.listenField(
      model.data.datastore,
      { ...model.data.record, field: 'text' },
      this._onValueChanged,
      this
    );
    this.model = model;
    this.editor = options.editorFactory({ host: this.editorHostNode, model });
    this.editor.setOption('readOnly', true);
  }

  /**
   * The code editor used by the editor.
   */
  readonly editor: CodeEditor.IEditor;

  /**
   * The code editor model used by the editor.
   */
  readonly model: CodeEditor.IModel;

  /**
   * The editor host node used by the JSON editor.
   */
  readonly headerNode: HTMLDivElement;

  /**
   * The editor host node used by the JSON editor.
   */
  readonly editorHostNode: HTMLDivElement;

  /**
   * The revert button used by the JSON editor.
   */
  readonly revertButtonNode: HTMLSpanElement;

  /**
   * The commit button used by the JSON editor.
   */
  readonly commitButtonNode: HTMLSpanElement;

  /**
   * The observable source.
   */
  get source(): JSONEditor.DataLocation<S, F> | null {
    return this._source;
  }
  set source(value: JSONEditor.DataLocation<S, F> | null) {
    if (this._source === value) {
      return;
    }
    if (this._listener) {
      this._listener.dispose();
      this._listener = null;
    }
    this._source = value;
    this.editor.setOption('readOnly', value === null);
    if (value) {
      this._listener = DatastoreExt.listenField(
        this._source.datastore,
        this._source.field,
        this._onSourceChanged,
        this
      );
    }
    this._setValue();
  }

  /**
   * Get whether the editor is dirty.
   */
  get isDirty(): boolean {
    return this._dataDirty || this._inputDirty;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the notebook panel's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'blur':
        this._evtBlur(event as FocusEvent);
        break;
      case 'click':
        this._evtClick(event as MouseEvent);
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    const node = this.editorHostNode;
    node.addEventListener('blur', this, true);
    node.addEventListener('click', this, true);
    this.revertButtonNode.hidden = true;
    this.commitButtonNode.hidden = true;
    this.headerNode.addEventListener('click', this);
    if (this.isVisible) {
      this.update();
    }
  }

  /**
   * Handle `after-show` messages for the widget.
   */
  protected onAfterShow(msg: Message): void {
    this.update();
  }

  /**
   * Handle `update-request` messages for the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    this.editor.refresh();
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    const node = this.editorHostNode;
    node.removeEventListener('blur', this, true);
    node.removeEventListener('click', this, true);
    this.headerNode.removeEventListener('click', this);
  }

  /**
   * Handle a change to the JSON of the source.
   */
  private _onSourceChanged(
    sender: Datastore,
    args: MapField.Change<JSONValue>
  ) {
    if (this._changeGuard) {
      return;
    }
    if (this._inputDirty || this.editor.hasFocus()) {
      this._dataDirty = true;
      return;
    }
    this._setValue();
  }

  /**
   * Handle change events.
   */
  private _onValueChanged(): void {
    let valid = true;
    try {
      const value = JSON.parse(this.editor.model.value);
      this.removeClass(ERROR_CLASS);
      this._inputDirty =
        !this._changeGuard && !JSONExt.deepEqual(value, this._originalValue);
    } catch (err) {
      this.addClass(ERROR_CLASS);
      this._inputDirty = true;
      valid = false;
    }
    this.revertButtonNode.hidden = !this._inputDirty;
    this.commitButtonNode.hidden = !valid || !this._inputDirty;
  }

  /**
   * Handle blur events for the text area.
   */
  private _evtBlur(event: FocusEvent): void {
    // Update the metadata if necessary.
    if (!this._inputDirty && this._dataDirty) {
      this._setValue();
    }
  }

  /**
   * Handle click events for the buttons.
   */
  private _evtClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.revertButtonNode.contains(target)) {
      this._setValue();
    } else if (this.commitButtonNode.contains(target)) {
      if (!this.commitButtonNode.hidden && !this.hasClass(ERROR_CLASS)) {
        this._changeGuard = true;
        this._mergeContent();
        this._changeGuard = false;
        this._setValue();
      }
    } else if (this.editorHostNode.contains(target)) {
      this.editor.focus();
    }
  }

  /**
   * Merge the user content.
   */
  private _mergeContent(): void {
    const model = this.editor.model;
    const old = this._originalValue;
    const user = JSON.parse(model.value) as JSONObject;
    const source = this.source;
    if (!source) {
      return;
    }

    let update: JSONObject = {};
    Object.keys(old).forEach(key => {
      // If it was in old and not in user, remove from the source.
      if (!(key in user)) {
        update[key] = null;
      }
    });
    Object.keys(user).forEach(key => {
      // If it is in user and has changed from old, set in new
      if (!JSONExt.deepEqual(user[key], old[key] || null)) {
        update[key] = user[key];
      }
    });
    let { datastore, field } = this._source;
    DatastoreExt.withTransaction(datastore, () => {
      DatastoreExt.updateField(datastore, field, update);
    });

  /**
   * Set the value given the owner contents.
   */
  private _setValue(): void {
    this._dataDirty = false;
    this._inputDirty = false;
    this.revertButtonNode.hidden = true;
    this.commitButtonNode.hidden = true;
    this.removeClass(ERROR_CLASS);
    const model = this.editor.model;
    let content = this._source
      ? (DatastoreExt.getField(
          this._source.datastore,
          this._source.field
        ) as ReadonlyJSONObject)
      : {};
    let content = this._source
      ? (DatastoreExt.getField(
          this._source.datastore,
          this._source.field
        ) as ReadonlyJSONObject)
      : {};
    this._changeGuard = true;
    if (content === void 0) {
      model.value = this._trans.__('No data!');
      this._originalValue = JSONExt.emptyObject;
    } else {
      const value = JSON.stringify(content, null, 4);
      model.value = value;
      this._originalValue = content;
      // Move the cursor to within the brace.
      if (value.length > 1 && value[0] === '{') {
        this.editor.setCursorPosition({ line: 0, column: 1 });
      }
    }
    this.editor.refresh();
    this._changeGuard = false;
    this.commitButtonNode.hidden = true;
    this.revertButtonNode.hidden = true;
  }

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _dataDirty = false;
  private _inputDirty = false;
  private _source: JSONEditor.DataLocation<S, F> | null = null;
  private _originalValue: ReadonlyJSONObject = JSONExt.emptyObject;
  private _changeGuard = false;
}

/**
 * The static namespace JSONEditor class statics.
 */
export namespace JSONEditor {
  /**
   * The options used to initialize a json editor.
   */
  export interface IOptions {
    /**
     * The editor factory used by the editor.
     */
    editorFactory: CodeEditor.Factory;

    /**
     * The language translator.
     */
    translator?: ITranslator;
  }

  /**
   * The subset of fields in a schema that represent a JSON Object.
   */
  export type MapFields<S extends Schema> = {
    [F in keyof S['fields']]: S['fields'][F] extends MapField<JSONValue>
      ? F
      : never;
  };

  /**
   * A field location referencing a JSON-able object.
   */
  export type DataLocation<
    S extends Schema,
    F extends keyof MapFields<S>
  > = DatastoreExt.DataLocation & {
    field: DatastoreExt.FieldLocation<S, F>;
  };

}
