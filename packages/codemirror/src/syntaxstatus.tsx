import React from 'react';

import { VDomRenderer, VDomModel } from '@jupyterlab/apputils';

import { CodeEditor } from '@jupyterlab/codeeditor';

import { DatastoreExt } from '@jupyterlab/datastore';

import {
  interactiveItem,
  Popup,
  showPopup,
  TextItem
} from '@jupyterlab/statusbar';

import { nullTranslator, ITranslator } from '@jupyterlab/translation';

import { Mode } from '.';

import { CommandRegistry } from '@lumino/commands';

import { JSONObject } from '@lumino/coreutils';

import { Datastore, RegisterField } from '@lumino/datastore';

import { IDisposable } from '@lumino/disposable';

import { Menu } from '@lumino/widgets';

/**
 * A namespace for `EditorSyntaxComponentStatics`.
 */
namespace EditorSyntaxComponent {
  /**
   * The props for the `EditorSyntaxComponent`.
   */
  export interface IProps {
    /**
     * The current CodeMirror mode for an editor.
     */
    mode: string;

    /**
     * A function to execute on clicking the component.
     * By default we provide a function that opens a menu
     * for CodeMirror mode selection.
     */
    handleClick: () => void;
  }
}

/**
 * A pure function that returns a tsx component for an editor syntax item.
 *
 * @param props: the props for the component.
 *
 * @returns an editor syntax component.
 */
function EditorSyntaxComponent(
  props: EditorSyntaxComponent.IProps
): React.ReactElement<EditorSyntaxComponent.IProps> {
  return <TextItem source={props.mode} onClick={props.handleClick} />;
}

/**
 * StatusBar item to change the language syntax highlighting of the file editor.
 */
export class EditorSyntaxStatus extends VDomRenderer<EditorSyntaxStatus.Model> {
  /**
   * Construct a new VDomRenderer for the status item.
   */
  constructor(opts: EditorSyntaxStatus.IOptions) {
    super(new EditorSyntaxStatus.Model());
    this._commands = opts.commands;
    this.translator = opts.translator || nullTranslator;
    const trans = this.translator.load('jupyterlab');

    this.addClass(interactiveItem);
    this.title.caption = trans.__('Change text editor syntax highlighting');
  }

  /**
   * Render the status item.
   */
  render() {
    if (!this.model) {
      return null;
    }
    return (
      <EditorSyntaxComponent
        mode={this.model.mode}
        handleClick={this._handleClick}
      />
    );
  }

  /**
   * Create a menu for selecting the mode of the editor.
   */
  private _handleClick = () => {
    const modeMenu = new Menu({ commands: this._commands });
    const command = 'codemirror:change-mode';
    if (this._popup) {
      this._popup.dispose();
    }
    Mode.getModeInfo()
      .sort((a, b) => {
        const aName = a.name || '';
        const bName = b.name || '';
        return aName.localeCompare(bName);
      })
      .forEach(spec => {
        if (spec.mode.indexOf('brainf') === 0) {
          return;
        }

        const args: JSONObject = {
          insertSpaces: true,
          name: spec.name!
        };

        modeMenu.addItem({
          command,
          args
        });
      });
    this._popup = showPopup({
      body: modeMenu,
      anchor: this,
      align: 'left'
    });
  };

  protected translator: ITranslator;
  private _commands: CommandRegistry;
  private _popup: Popup | null = null;
}

/**
 * A namespace for EditorSyntax statics.
 */
export namespace EditorSyntaxStatus {
  /**
   * A VDomModel for the current editor/mode combination.
   */
  export class Model extends VDomModel {
    /**
     * The current mode for the editor. If no editor is present,
     * returns the empty string.
     */
    get mode(): string {
      return this._mode;
    }

    /**
     * The current editor for the application editor tracker.
     */
    get editor(): CodeEditor.IEditor | null {
      return this._editor;
    }
    set editor(editor: CodeEditor.IEditor | null) {
      if (this._mimeTypeListener) {
        this._mimeTypeListener.dispose();
        // TODO(RTC)
        // this._mimeTypeListener = null;
      }
      const oldMode = this._mode;
      this._editor = editor;
      if (this._editor === null) {
        this._mode = '';
      } else {
        const spec = Mode.findByMIME(this._editor.model.mimeType);
        this._mode = spec.name || spec.mode;
        if (editor) {
          DatastoreExt.listenField(
            editor.model.data.datastore,
            { ...editor.model.data.record, field: 'mimeType' },
            this._onMIMETypeChange
          );
        }
      }

      this._triggerChange(oldMode, this._mode);
    }

    /**
     * If the editor mode changes, update the model.
     */
    private _onMIMETypeChange = (
      sender: Datastore,
      change: RegisterField.Change<string>
    ) => {
      const oldMode = this._mode;
      const spec = Mode.findByMIME(change.current);
      this._mode = spec.name || spec.mode;

      this._triggerChange(oldMode, this._mode);
    };

    /**
     * Trigger a rerender of the model.
     */
    private _triggerChange(oldState: string, newState: string) {
      if (oldState !== newState) {
        this.stateChanged.emit(void 0);
      }
    }

    private _mode: string = '';
    private _editor: CodeEditor.IEditor | null = null;
    private _mimeTypeListener: IDisposable;
  }

  /**
   * Options for the EditorSyntax status item.
   */
  export interface IOptions {
    /**
     * The application command registry.
     */
    commands: CommandRegistry;

    /**
     * The language translator.
     */
    translator?: ITranslator;
  }
}
