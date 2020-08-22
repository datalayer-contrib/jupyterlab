// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISessionContext,
  Clipboard,
  Dialog,
  showDialog
} from '@jupyterlab/apputils';

import {
  Cell,
  CellData,
  CodeCell,
  CodeCellData,
  ICellData,
  MarkdownCell,
  MarkdownCellData,
  RawCellData
  isMarkdownCellModel,
  isRawCellModel,
  isCodeCellModel
} from '@jupyterlab/cells';

import * as nbformat from '@jupyterlab/nbformat';

import { KernelMessage } from '@jupyterlab/services';

import { DatastoreExt } from '@jupyterlab/datastore';

import { OutputAreaData } from '@jupyterlab/outputarea';

import { KernelMessage } from '@jupyterlab/services';

import { ArrayExt, each } from '@lumino/algorithm';

import { JSONObject, JSONExt } from '@lumino/coreutils';

import { ElementExt } from '@lumino/domutils';

import { ISignal, Signal } from '@lumino/signaling';

import * as React from 'react';

import { INotebookModel } from './model';

import { Notebook } from './widget';
import { nullTranslator, ITranslator } from '@jupyterlab/translation';

/**
 * The mimetype used for Jupyter cell data.
 */
const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';

/**
 * A collection of actions that run against notebooks.
 *
 * #### Notes
 * All of the actions are a no-op if there is no model on the notebook.
 * The actions set the widget `mode` to `'command'` unless otherwise specified.
 * The actions will preserve the selection on the notebook widget unless
 * otherwise specified.
 */
export class NotebookActions {
  /**
   * A signal that emits whenever a cell is run.
   */
  static get executed(): ISignal<any, { notebook: Notebook; cell: Cell }> {
    return Private.executed;
  }

  /**
   * A private constructor for the `NotebookActions` class.
   *
   * #### Notes
   * This class can never be instantiated. Its static member `executed` will be
   * merged with the `NotebookActions` namespace. The reason it exists as a
   * standalone class is because at run time, the `Private.executed` variable
   * does not yet exist, so it needs to be referenced via a getter.
   */
  private constructor() {
    // Intentionally empty.
  }
}

/**
 * A namespace for `NotebookActions` static methods.
 */
export namespace NotebookActions {
  /**
   * Split the active cell into two or more cells.
   *
   * @param widget - The target notebook widget.
   *
   * #### Notes
   * It will preserve the existing mode.
   * The last cell will be activated.
   * The existing selection will be cleared.
   * The leading whitespace in the second cell will be removed.
   * If there is no content, two empty cells will be created.
   * Both cells will have the same type as the original cell.
   * If the cells is are markdown cells, they will be unrendered.
   * This action can be undone.
   */
  export function splitCell(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.deselectAll();

    const nbModel = notebook.model;
    const index = notebook.activeCellIndex;
    const child = notebook.widgets[index];
    const editor = child.editor;
    const selections = editor.getSelections();
    const orig = child.editor.model.value;

    const offsets = [0];


    /*

    TODO(RTC)


         // Create new models to preserve history.
-    const clone0 = Private.cloneCell(nbModel, child.model);
-    const clone1 = Private.cloneCell(nbModel, child.model);
+    const clone0 = Private.cloneCell(nbModel, child);
+    const clone1 = Private.cloneCell(nbModel, child);
+
+    if (child.type === 'code') {
+      OutputAreaData.clear(clone0);
+    }
+    const datastore = nbModel.data.datastore;
+    DatastoreExt.withTransaction(datastore, () => {
+      const text0 = orig
+        .slice(0, offset)
+        .replace(/^\n+/, '')
+        .replace(/\n+$/, '');
+      const text1 = orig
+        .slice(offset)
+        .replace(/^\n+/, '')
+        .replace(/\n+$/, '');
+      DatastoreExt.updateField(
+        datastore,
+        { ...clone0.record, field: 'text' },
+        { index: 0, remove: orig.length, text: text0 }
+      );
+      DatastoreExt.updateField(
+        datastore,
+        { ...clone1.record, field: 'text' },
+        { index: 0, remove: orig.length, text: text1 }
+      );
+      DatastoreExt.updateField(
+        datastore,
+        { ...nbModel.data.record, field: 'cells' },
+        {
+          index,
+          remove: 1,
+          values: [clone0.record.record, clone1.record.record]
+        }
+      );
+    });
 
-    if (clone0.type === 'code') {
-      (clone0 as ICodeCellModel).outputs.clear();
+    if (child.type === 'markdown') {
+      (notebook.widgets[index] as MarkdownCell).rendered = false;
+      (notebook.widgets[index + 1] as MarkdownCell).rendered = false;
     }
-    clone0.value.text = orig
-      .slice(0, offset)
-      .replace(/^\n+/, '')
-      .replace(/\n+$/, '');
-    clone1.value.text = orig
-      .slice(offset)
-      .replace(/^\n+/, '')
-      .replace(/\n+$/, '');
-
-    // Make the changes while preserving history.
-    const cells = nbModel.cells;
-
-    cells.beginCompoundOperation();
-    cells.set(index, clone0);
-    cells.insert(index + 1, clone1);
-    cells.endCompoundOperation();
-
-    notebook.activeCellIndex++;
+    notebook.activeCellIndex = index + 1;
     Private.handleState(notebook, state);
     // Create new models to preserve history.
-    const clone0 = Private.cloneCell(nbModel, child.model);
-    const clone1 = Private.cloneCell(nbModel, child.model);
+    const clone0 = Private.cloneCell(nbModel, child);
+    const clone1 = Private.cloneCell(nbModel, child);
+
+    if (child.type === 'code') {
+      OutputAreaData.clear(clone0);
+    }
+    const datastore = nbModel.data.datastore;
+    DatastoreExt.withTransaction(datastore, () => {
+      const text0 = orig
+        .slice(0, offset)
+        .replace(/^\n+/, '')
+        .replace(/\n+$/, '');
+      const text1 = orig
+        .slice(offset)
+        .replace(/^\n+/, '')
+        .replace(/\n+$/, '');
+      DatastoreExt.updateField(
+        datastore,
+        { ...clone0.record, field: 'text' },
+        { index: 0, remove: orig.length, text: text0 }
+      );
+      DatastoreExt.updateField(
+        datastore,
+        { ...clone1.record, field: 'text' },
+        { index: 0, remove: orig.length, text: text1 }
+      );
+      DatastoreExt.updateField(
+        datastore,
+        { ...nbModel.data.record, field: 'cells' },
+        {
+          index,
+          remove: 1,
+          values: [clone0.record.record, clone1.record.record]
+        }
+      );
+    });
 
-    if (clone0.type === 'code') {
-      (clone0 as ICodeCellModel).outputs.clear();
+    if (child.type === 'markdown') {
+      (notebook.widgets[index] as MarkdownCell).rendered = false;
+      (notebook.widgets[index + 1] as MarkdownCell).rendered = false;
     }
-    clone0.value.text = orig
-      .slice(0, offset)
-      .replace(/^\n+/, '')
-      .replace(/\n+$/, '');
-    clone1.value.text = orig
-      .slice(offset)
-      .replace(/^\n+/, '')
-      .replace(/\n+$/, '');
-
-    // Make the changes while preserving history.
-    const cells = nbModel.cells;
-
-    cells.beginCompoundOperation();
-    cells.set(index, clone0);
-    cells.insert(index + 1, clone1);
-    cells.endCompoundOperation();
-
-    notebook.activeCellIndex++;
+    notebook.activeCellIndex = index + 1;
     Private.handleState(notebook, state);


    */

    for (let i = 0; i < selections.length; i++) {
      // append start and end to handle selections
      // cursors will have same start and end
      const start = editor.getOffsetAt(selections[i].start);
      const end = editor.getOffsetAt(selections[i].end);
      if (start < end) {
        offsets.push(start);
        offsets.push(end);
      } else if (end < start) {
        offsets.push(end);
        offsets.push(start);
      } else {
        offsets.push(start);
      }
    }

    offsets.push(orig.length);

    const clones: ICellModel[] = [];
    for (let i = 0; i + 1 < offsets.length; i++) {
      const clone = Private.cloneCell(nbModel, child.model);
      clones.push(clone);
    }

    for (let i = 0; i < clones.length; i++) {
      if (i !== clones.length - 1 && clones[i].type === 'code') {
        (clones[i] as ICodeCellModel).outputs.clear();
      }
      clones[i].value.text = orig
        .slice(offsets[i], offsets[i + 1])
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');
    }

    const cells = nbModel.cells;

    cells.beginCompoundOperation();
    for (let i = 0; i < clones.length; i++) {
      if (i === 0) {
        cells.set(index, clones[i]);
      } else {
        cells.insert(index + i, clones[i]);
      }
    }
    cells.endCompoundOperation();

    notebook.activeCellIndex = index + clones.length - 1;
    Private.handleState(notebook, state);
  }

  /**
   * Merge the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * If only one cell is selected, the next cell will be selected.
   * If the active cell is a code cell, its outputs will be cleared.
   * This action can be undone.
   * The final cell will have the same type as the active cell.
   * If the active cell is a markdown cell, it will be unrendered.
   */
  export function mergeCells(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const toMerge: string[] = [];
    const toDelete: string[] = [];
    const model = notebook.model;
    const primary = notebook.activeCell;
    const active = notebook.activeCellIndex;
    // The first active cell in the selection range.
    const first = ArrayExt.findFirstIndex(notebook.widgets, w =>
      notebook.isSelectedOrActive(w)
    );
    const attachments: nbformat.IAttachments = {};

    // Get the cells to merge.
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        toMerge.push(child.editor.model.value);
        toDelete.push(child.data.record.record);
        // Collect attachments if the cell is a markdown cell or a raw cell
        const model = child.model;
        if (isRawCellModel(model) || isMarkdownCellModel(model)) {
          for (const key of model.attachments.keys) {
            attachments[key] = model.attachments.get(key)!.toJSON();
          }
        }
      }
    });

    // Check for only a single cell selected.
    if (toMerge.length === 1) {
      // Bail if it is the last cell.
      if (active === notebook.widgets.length - 1) {
        return;
      }

      // Otherwise merge with the next cell.
      const cellModel = notebook.widgets[active + 1];

      toMerge.push(next.editor.model.value);
      toDelete.push(next.data.record.record);
    }

    notebook.deselectAll();

    // Create a new cell for the source to preserve history.
    const clone = Private.cloneCell(model, primary);
    const datastore = model.data.datastore;

    DatastoreExt.withTransaction(datastore, () => {
      const text = toMerge.join('\n\n');
      if (primary.type === 'code') {
        OutputAreaData.clear(clone);
      }
      DatastoreExt.updateField(
        datastore,
        { ...clone.record, field: 'text' },
        { index: 0, remove: primary.editor.model.value.length, text }
      );
      DatastoreExt.updateField(
        datastore,
        { ...model.data.record, field: 'cells' },
        {
          index: first,
          remove: toDelete.length,
          values: [clone.record.record]
        }
      );
    });

    // If the original cell is a markdown cell, make sure
    // the new cell is unrendered.
    notebook.activeCellIndex = first;
    if (primary.type === 'markdown') {
      (notebook.activeCell as MarkdownCell).rendered = false;
    }

    Private.handleState(notebook, state);
  }

  /**
   * Delete the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The cell after the last selected cell will be activated.
   * It will add a code cell if all cells are deleted.
   * This action can be undone.
   */
  export function deleteCells(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    Private.deleteCells(notebook);
    Private.handleState(notebook, state, true);
  }

  /**
   * Insert a new code cell above the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new cell will the active cell.
   */
  export function insertAbove(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const model = notebook.model;
    const cellId = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell
    );
    const active = notebook.activeCellIndex;

    const { datastore, record } = model.data;
    DatastoreExt.withTransaction(datastore, () => {
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'cells' },
        { index: active, remove: 0, values: [cellId] }
      );
    });

    // Make the newly inserted cell active.
    notebook.activeCellIndex = active;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Insert a new code cell below the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new cell will be the active cell.
   */
  export function insertBelow(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const model = notebook.model;
    const active = notebook.activeCellIndex;
    const cellId = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell
    );

    const { datastore, record } = model.data;
    DatastoreExt.withTransaction(datastore, () => {
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'cells' },
        { index: active + 1, remove: 0, values: [cellId] }
      );
    });

    // Make the newly inserted cell active.
    notebook.activeCellIndex++;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Move the selected cell(s) down.
   *
   * @param widgget = The target notebook widget.
   */
  export function moveDown(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const widgets = notebook.widgets;

    const toMove: string[] = [];
    const indices: number[] = [];
    const active = notebook.activeCellIndex;
    widgets.forEach((cell, index) => {
      if (notebook.isSelectedOrActive(cell)) {
        toMove.push(cell.data.record.record);
        indices.push(index);
      }
    });
    if (indices.length && indices[indices.length - 1] === widgets.length) {
      return;
    }
    const { datastore, record } = notebook.model.data;
    DatastoreExt.withTransaction(datastore, () => {
      // Proceed through the toMove list in the reverse direction
      // so we get the final ordering right.
      toMove.reverse();
      indices.reverse();
      toMove.forEach((id, idx) => {
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: indices[idx], remove: 1, values: [] }
        );
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: indices[idx] + 1, remove: 0, values: [id] }
        );
      });
    });

    // Reselect the original cells.
    widgets.forEach((cell, index) => {
      if (toMove.indexOf(cell.data.record.record) !== -1) {
        notebook.select(cell);
      }
    });
    notebook.activeCellIndex = active + 1;
    Private.handleState(notebook, state, true);
  }

  /**
   * Move the selected cell(s) up.
   *
   * @param widget - The target notebook widget.
   */
  export function moveUp(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const widgets = notebook.widgets;

    const toMove: string[] = [];
    const indices: number[] = [];
    const active = notebook.activeCellIndex;
    widgets.forEach((cell, index) => {
      if (notebook.isSelectedOrActive(cell)) {
        toMove.push(cell.data.record.record);
        indices.push(index);
      }
    });
    if (indices.length && indices[0] === 0) {
      return;
    }
    const { datastore, record } = notebook.model.data;
    DatastoreExt.withTransaction(datastore, () => {
      // Proceed through the toMove list in the forward direction
      // so we get the final ordering right.
      toMove.forEach((id, idx) => {
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: indices[idx], remove: 1, values: [] }
        );
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: indices[idx] - 1, remove: 0, values: [id] }
        );
      });
    });
    // Reselect the original cells.
    widgets.forEach((cell, index) => {
      if (toMove.indexOf(cell.data.record.record) !== -1) {
        notebook.select(cell);
      }
    });
    notebook.activeCellIndex = active - 1;
    Private.handleState(notebook, state, true);
  }

  /**
   * Change the selected cell type(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param value - The target cell type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any cells converted to markdown will be unrendered.
   */
  export function changeCellType(
    notebook: Notebook,
    value: nbformat.CellType
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    Private.changeCellType(notebook, value);
    Private.handleState(notebook, state);
  }

  /**
   * Run the selected cell(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The last selected cell will be activated, but not scrolled into view.
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   */
  export function run(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, false);
    return promise;
  }

  /**
   * Run the selected cell(s) and advance to the next cell.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * The cell after the last selected cell will be activated and scrolled into view.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * If the last selected cell is the last cell, a new code cell
   * will be created in `'edit'` mode.  The new cell creation can be undone.
   */
  export function runAndAdvance(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;

    if (notebook.activeCellIndex === notebook.widgets.length - 1) {
      const cellId = model.contentFactory.createCell(
        notebook.notebookConfig.defaultCell
      );

      const { datastore, record } = model.data;
      DatastoreExt.withTransaction(datastore, () => {
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: notebook.activeCellIndex + 1, remove: 0, values: [cellId] }
        );
      });
      notebook.activeCellIndex++;
      notebook.mode = 'edit';
    } else {
      notebook.activeCellIndex++;
    }
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run the selected cell(s) and insert a new code cell.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The widget mode will be set to `'edit'` after running.
   * The existing selection will be cleared.
   * The cell insert can be undone.
   * The new cell will be scrolled into view.
   */
  export function runAndInsert(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);
    const promise = Private.runSelected(notebook, sessionContext);
    const model = notebook.model;
    const cellId = model.contentFactory.createCell(
      notebook.notebookConfig.defaultCell
    );

    const { datastore, record } = model.data;
    DatastoreExt.withTransaction(datastore, () => {
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'cells' },
        { index: notebook.activeCellIndex + 1, remove: 0, values: [cellId] }
      );
    });
    notebook.activeCellIndex++;
    notebook.mode = 'edit';
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells in the notebook.
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAll(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(child => {
      notebook.select(child);
    });

    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, true);
    return promise;
  }

  export function renderAllMarkdown(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }
    const previousIndex = notebook.activeCellIndex;
    const state = Private.getState(notebook);
    notebook.widgets.forEach((child, index) => {
      if (child.type === 'markdown') {
        notebook.select(child);
        // This is to make sure that the activeCell
        // does not get executed
        notebook.activeCellIndex = index;
      }
    });
    if (notebook.activeCell.type !== 'markdown') {
      return Promise.resolve(true);
    }
    const promise = Private.runSelected(notebook, sessionContext);
    notebook.activeCellIndex = previousIndex;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells before the currently active cell (exclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The currently active cell will remain selected.
   */
  export function runAllAbove(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    const { activeCell, activeCellIndex, model } = notebook;

    if (!model || !activeCell || activeCellIndex < 1) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex--;
    notebook.deselectAll();
    for (let i = 0; i < notebook.activeCellIndex; ++i) {
      notebook.select(notebook.widgets[i]);
    }

    const promise = Private.runSelected(notebook, sessionContext);

    notebook.activeCellIndex++;
    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Run all of the cells after the currently active cell (inclusive).
   *
   * @param notebook - The target notebook widget.
   *
   * @param sessionContext - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code cells from executing.
   * All markdown cells will be rendered.
   * The last cell in the notebook will be activated and scrolled into view.
   */
  export function runAllBelow(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    if (!notebook.model || !notebook.activeCell) {
      return Promise.resolve(false);
    }

    const state = Private.getState(notebook);

    notebook.deselectAll();
    for (let i = notebook.activeCellIndex; i < notebook.widgets.length; ++i) {
      notebook.select(notebook.widgets[i]);
    }

    const promise = Private.runSelected(notebook, sessionContext);

    Private.handleRunState(notebook, state, true);
    return promise;
  }

  /**
   * Replaces the selection in the active cell of the notebook.
   *
   * @param notebook - The target notebook widget.
   * @param text - The text to replace the selection.
   */
  export function replaceSelection(notebook: Notebook, text: string): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.activeCell.editor.replaceSelection?.(text);
  }

  /**
   * Select the above the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the first cell is the active cell.
   * This will skip any collapsed cells.
   * The existing selection will be cleared.
   */
  export function selectAbove(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    if (notebook.activeCellIndex === 0) {
      return;
    }

    let possibleNextCell = notebook.activeCellIndex - 1;

    // find first non hidden cell above current cell
    if (notebook.mode === 'edit') {
      while (notebook.widgets[possibleNextCell].inputHidden) {
        // If we are at the top cell, we cannot change selection.
        if (possibleNextCell === 0) {
          return;
        }
        possibleNextCell -= 1;
      }
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex = possibleNextCell;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Select the cell below the active cell.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the last cell is the active cell.
   * This will skip any collapsed cells.
   * The existing selection will be cleared.
   */
  export function selectBelow(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    const maxCellIndex = notebook.widgets.length - 1;
    if (notebook.activeCellIndex === maxCellIndex) {
      return;
    }

    let possibleNextCell = notebook.activeCellIndex + 1;

    // find first non hidden cell below current cell
    if (notebook.mode === 'edit') {
      while (notebook.widgets[possibleNextCell].inputHidden) {
        // If we are at the bottom cell, we cannot change selection.
        if (possibleNextCell === maxCellIndex) {
          return;
        }
        possibleNextCell += 1;
      }
    }

    const state = Private.getState(notebook);

    notebook.activeCellIndex = possibleNextCell;
    notebook.deselectAll();
    Private.handleState(notebook, state, true);
  }

  /**
   * Extend the selection to the cell above.
   *
   * @param notebook - The target notebook widget.
   * @param toTop - If true, denotes selection to extend to the top.
   *
   * #### Notes
   * This is a no-op if the first cell is the active cell.
   * The new cell will be activated.
   */
  export function extendSelectionAbove(
    notebook: Notebook,
    toTop: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    // Do not wrap around.
    if (notebook.activeCellIndex === 0) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.mode = 'command';
    // Check if toTop is true, if yes, selection is made to the top.
    if (toTop) {
      notebook.extendContiguousSelectionTo(0);
    } else {
      notebook.extendContiguousSelectionTo(notebook.activeCellIndex - 1);
    }
    Private.handleState(notebook, state, true);
  }

  /**
   * Extend the selection to the cell below.
   *
   * @param notebook - The target notebook widget.
   * @param toBottom - If true, denotes selection to extend to the bottom.
   *
   * #### Notes
   * This is a no-op if the last cell is the active cell.
   * The new cell will be activated.
   */
  export function extendSelectionBelow(
    notebook: Notebook,
    toBottom: boolean = false
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    // Do not wrap around.
    if (notebook.activeCellIndex === notebook.widgets.length - 1) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.mode = 'command';
    // Check if toBottom is true, if yes selection is made to the bottom.
    if (toBottom) {
      notebook.extendContiguousSelectionTo(notebook.widgets.length - 1);
    } else {
      notebook.extendContiguousSelectionTo(notebook.activeCellIndex + 1);
    }
    Private.handleState(notebook, state, true);
  }

  /**
   * Select all of the cells of the notebook.
   *
   * @param notebook - the target notebook widget.
   */
  export function selectAll(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.widgets.forEach(child => {
      notebook.select(child);
    });
  }

  /**
   * Deselect all of the cells of the notebook.
   *
   * @param notebook - the targe notebook widget.
   */
  export function deselectAll(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    notebook.deselectAll();
  }

  /**
   * Copy the selected cell data to a clipboard.
   *
   * @param notebook - The target notebook widget.
   */
  export function copy(notebook: Notebook): void {
    Private.copyOrCut(notebook, false);
  }

  /**
   * Cut the selected cell data to a clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This action can be undone.
   * A new code cell is added if all cells are cut.
   */
  export function cut(notebook: Notebook): void {
    Private.copyOrCut(notebook, true);
  }

  /**
   * Paste cells from the application clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @param mode - the mode of the paste operation: 'below' pastes cells
   *   below the active cell, 'above' pastes cells above the active cell,
   *   and 'replace' removes the currently selected cells and pastes cells
   *   in their place.
   *
   * #### Notes
   * The last pasted cell becomes the active cell.
   * This is a no-op if there is no cell data on the clipboard.
   * This action can be undone.
   */
  export function paste(
    notebook: Notebook,
    mode: 'below' | 'above' | 'replace' = 'below'
  ): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const clipboard = Clipboard.getInstance();

    if (!clipboard.hasData(JUPYTER_CELL_MIME)) {
      return;
    }

    const state = Private.getState(notebook);
    const values = clipboard.getData(JUPYTER_CELL_MIME) as nbformat.IBaseCell[];
    const model = notebook.model;

    notebook.mode = 'command';

    const newCells = values.map(cell => {
      switch (cell.cell_type) {
        case 'code':
          return model.contentFactory.createCodeCell(
            cell as nbformat.ICodeCell
          );
        case 'markdown':
          return model.contentFactory.createMarkdownCell(
            cell as nbformat.IMarkdownCell
          );
        default:
          return model.contentFactory.createRawCell(cell as nbformat.IRawCell);
      }
    });

    let index: number;

    const { datastore, record } = model.data;
    DatastoreExt.withTransaction(datastore, () => {
      // Set the starting index of the paste operation depending upon the mode.
      switch (mode) {
        case 'below':
          index = notebook.activeCellIndex;
          break;
        case 'above':
          index = notebook.activeCellIndex - 1;
          break;
        case 'replace':
          // Find the cells to delete.
          const toDelete: number[] = [];

          notebook.widgets.forEach((child, index) => {
            const metadata = DatastoreExt.getField(child.data.datastore, {
              ...child.data.record,
              field: 'metadata'
            });
 
           if (notebook.isSelectedOrActive(child) && deletable) {
              toDelete.push(index);
            }
          });
          // If cells are not deletable, we may not have anything to delete.
          if (toDelete.length > 0) {
            // Delete the cells as one undo event.
            toDelete.reverse().forEach(i => {
              DatastoreExt.updateField(
                datastore,
                { ...record, field: 'cells' },
                { index: i, remove: 1, values: [] }
              );
            });
          }
          index = toDelete[0]; // Now the last cell.
          break;
        default:
          break;
      }

      newCells.forEach(cellId => {
        DatastoreExt.updateField(
          datastore,
          { ...record, field: 'cells' },
          { index: ++index, remove: 0, values: [cellId] }
        );
      });
    });

    notebook.activeCellIndex += newCells.length;
    notebook.deselectAll();
    Private.handleState(notebook, state);
  }

  /**
   * Undo a cell action.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This is a no-op if if there are no cell actions to undo.
   */
  export function undo(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }
    // TODO(RTC)
  }

  /**
   * Redo a cell action.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * This is a no-op if there are no cell actions to redo.
   */
  export function redo(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    // TODO(RTC)
  }

  /**
   * Toggle the line number of all cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The original state is based on the state of the active cell.
   * The `mode` of the widget will be preserved.
   */
  export function toggleAllLineNumbers(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);
    const config = notebook.editorConfig;
    const lineNumbers = !(
      config.code.lineNumbers &&
      config.markdown.lineNumbers &&
      config.raw.lineNumbers
    );
    const newConfig = {
      code: { ...config.code, lineNumbers },
      markdown: { ...config.markdown, lineNumbers },
      raw: { ...config.raw, lineNumbers }
    };

    notebook.editorConfig = newConfig;
    Private.handleState(notebook, state);
  }

  /**
   * Clear the code outputs of the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget `mode` will be preserved.
   */
  export function clearOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    each(notebook.widgets, (cell: Cell, index) => {
      const child = notebook.widgets[index];

      if (notebook.isSelectedOrActive(child) && cell.type === 'code') {
        (child as CodeCell).outputHidden = false;
        const { datastore, record } = cell.data;
        DatastoreExt.withTransaction(datastore, () => {
          OutputAreaData.clear(cell.data);
          DatastoreExt.updateField(
            datastore,
            { ...record, field: 'executionCount' },
            null
          );
        });
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Clear all the code outputs on the widget.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The widget `mode` will be preserved.
   */
  export function clearAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    each(notebook.widgets, (cell: Cell, index) => {
      if (cell.type === 'code') {
        const { datastore, record } = cell.data;
        DatastoreExt.withTransaction(datastore, () => {
          OutputAreaData.clear(cell.data);
          DatastoreExt.updateField(
            datastore,
            { ...record, field: 'executionCount' },
            null
          );
        });
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the code on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        cell.inputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the code on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        cell.inputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the code on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideAllCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.type === 'code') {
        cell.inputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the code on all code cells.
   *
   * @param widget - The target notebook widget.
   */
  export function showAllCode(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.type === 'code') {
        cell.inputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the output on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideOutput(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        (cell as CodeCell).outputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the output on selected code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showOutput(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        (cell as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Hide the output on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function hideAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.type === 'code') {
        (cell as CodeCell).outputHidden = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Show the output on all code cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function showAllOutputs(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (cell.model.type === 'code') {
        (cell as CodeCell).outputHidden = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Enable output scrolling for all selected cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function enableOutputScrolling(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        (cell as CodeCell).outputsScrolled = true;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Disable output scrolling for all selected cells.
   *
   * @param notebook - The target notebook widget.
   */
  export function disableOutputScrolling(notebook: Notebook): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    notebook.widgets.forEach(cell => {
      if (notebook.isSelectedOrActive(cell) && cell.type === 'code') {
        (cell as CodeCell).outputsScrolled = false;
      }
    });
    Private.handleState(notebook, state);
  }

  /**
   * Go to the last cell that is run or current if it is running.
   *
   * Note: This requires execution timing to be toggled on or this will have
   * no effect.
   *
   * @param notebook - The target notebook widget.
   */
  export function selectLastRunCell(notebook: Notebook): void {
    let latestTime: Date | null = null;
    let latestCellIdx: number | null = null;
    notebook.widgets.forEach((cell, cellIndx) => {
      if (cell.model.type === 'code') {
        const execution = (cell as CodeCell).model.metadata.get('execution');
        if (
          execution &&
          JSONExt.isObject(execution) &&
          execution['iopub.status.busy'] !== undefined
        ) {
          // The busy status is used as soon as a request is received:
          // https://jupyter-client.readthedocs.io/en/stable/messaging.html
          const timestamp = execution['iopub.status.busy']!.toString();
          if (timestamp) {
            const startTime = new Date(timestamp);
            if (!latestTime || startTime >= latestTime) {
              latestTime = startTime;
              latestCellIdx = cellIndx;
            }
          }
        }
      }
    });
    if (latestCellIdx !== null) {
      notebook.activeCellIndex = latestCellIdx;
    }
  }

  /**
   * Set the markdown header level.
   *
   * @param notebook - The target notebook widget.
   *
   * @param level - The header level.
   *
   * #### Notes
   * All selected cells will be switched to markdown.
   * The level will be clamped between 1 and 6.
   * If there is an existing header, it will be replaced.
   * There will always be one blank space after the header.
   * The cells will be unrendered.
   */
  export function setMarkdownHeader(notebook: Notebook, level: number) {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = Private.getState(notebook);

    level = Math.min(Math.max(level, 1), 6);
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        Private.setMarkdownHeader(child, level);
      }
    });
    Private.changeCellType(notebook, 'markdown');
    Private.handleState(notebook, state);
  }

  /**
   * Trust the notebook after prompting the user.
   *
   * @param notebook - The target notebook widget.
   *
   * @returns a promise that resolves when the transaction is finished.
   *
   * #### Notes
   * No dialog will be presented if the notebook is already trusted.
   */
  export function trust(
    notebook: Notebook,
    translator?: ITranslator
  ): Promise<void> {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');

    const model = notebook.model;
    if (!model) {
      return Promise.resolve();
    }
    // Do nothing if already trusted.

    const trusted = notebook.widgets.every(cell =>
      DatastoreExt.getField(cell.data.datastore, {
        ...cell.data.record,
        field: 'trusted'
      })
    );
    // FIXME
    const trustMessage = (
      <p>
        {trans.__(
          'A trusted Jupyter notebook may execute hidden malicious code when you openit.'
        )}
        <br />
        {trans.__(
          'Selecting trust will re-render this notebook in a trusted state.'
        )}
        <br />
        {trans.__(
          'For more information, see the <a href="https://jupyter-notebook.readthedocs.io/en/stable/security.html">%1</a>',
          trans.__('Jupyter security documentation')
        )}
      </p>
    );

    if (trusted) {
      return showDialog({
        body: trans.__('Notebook is already trusted'),
        buttons: [Dialog.okButton({ label: trans.__('Ok') })]
      }).then(() => undefined);
    }

    return showDialog({
      body: trustMessage,
      title: trans.__('Trust this notebook?'),
      buttons: [
        Dialog.cancelButton({ label: trans.__('Cancel') }),
        Dialog.warnButton({ label: trans.__('Ok') })
      ] // FIXME?
    }).then(result => {
      if (result.button.accept) {
        DatastoreExt.withTransaction(model.data.datastore, () => {
          notebook.widgets.forEach(cell => {
            DatastoreExt.updateField(
              cell.data.datastore,
              { ...cell.data.record, field: 'trusted' },
              true
            );
            OutputAreaData.setTrusted(cell.data, true);
          });
        });
      }
    });
  }
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * A signal that emits whenever a cell is run.
   */
  export const executed = new Signal<any, { notebook: Notebook; cell: Cell }>(
    {}
  );

  /**
   * The interface for a widget state.
   */
  export interface IState {
    /**
     * Whether the widget had focus.
     */
    wasFocused: boolean;

    /**
     * The active cell before the action.
     */
    activeCell: Cell | null;
  }

  /**
   * Get the state of a widget before running an action.
   */
  export function getState(notebook: Notebook): IState {
    return {
      wasFocused: notebook.node.contains(document.activeElement),
      activeCell: notebook.activeCell
    };
  }

  /**
   * Handle the state of a widget after running an action.
   */
  export function handleState(
    notebook: Notebook,
    state: IState,
    scrollIfNeeded = false
  ): void {
    const { activeCell, node } = notebook;

    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }

    if (scrollIfNeeded && activeCell) {
      ElementExt.scrollIntoViewIfNeeded(node, activeCell.node);
    }
  }

  /**
   * Handle the state of a widget after running a run action.
   */
  export function handleRunState(
    notebook: Notebook,
    state: IState,
    scroll = false
  ): void {
    if (state.wasFocused || notebook.mode === 'edit') {
      notebook.activate();
    }
    if (scroll && state.activeCell) {
      // Scroll to the top of the previous active cell output.
      const rect = state.activeCell.inputArea.node.getBoundingClientRect();

      notebook.scrollToPosition(rect.bottom, 45);
    }
  }

  /**
   * Clone a cell model.
   */
  export function cloneCell(
    model: INotebookModel,
    cell: Cell
  ): ICellData.DataLocation {
    let id = '';
    const { type, data } = cell;
    switch (type) {
      case 'code':
        id = model.contentFactory.createCodeCell(CodeCellData.toJSON(data));
        break;
      case 'markdown':
        id = model.contentFactory.createMarkdownCell(
          MarkdownCellData.toJSON(data)
        );
        break;
      default:
        id = model.contentFactory.createRawCell(RawCellData.toJSON(data));
        break;
    }
    return {
      datastore: data.datastore,
      record: { ...data.record, record: id },
      outputs: data.outputs
    };
  }

  /**
   * Run the selected cells.
   */
  export function runSelected(
    notebook: Notebook,
    sessionContext?: ISessionContext
  ): Promise<boolean> {
    notebook.mode = 'command';

    let lastIndex = notebook.activeCellIndex;
    const selected = notebook.widgets.filter((child, index) => {
      const active = notebook.isSelectedOrActive(child);

      if (active) {
        lastIndex = index;
      }

      return active;
    });

    notebook.activeCellIndex = lastIndex;
    notebook.deselectAll();

    return Promise.all(
      selected.map(child => runCell(notebook, child, sessionContext))
    )
      .then(results => {
        if (notebook.isDisposed) {
          return false;
        }

        // Post an update request.
        notebook.update();

        return results.every(result => result);
      })
      .catch(reason => {
        if (reason.message === 'KernelReplyNotOK') {
          selected.map(cell => {
            // Remove '*' prompt from cells that didn't execute
            const executionCount = DatastoreExt.getField(cell.data.datastore, {
              ...cell.data.record,
              field: 'executionCount'
            });
            if (cell.type === 'code' && executionCount == null) {
              cell.setPrompt('');
            }
          });
        } else {
          throw reason;
        }

        notebook.update();

        return false;
      });
  }

  /**
   * Run a cell.
   */
  export function runCell(
    notebook: Notebook,
    cell: Cell,
    sessionContext?: ISessionContext,
    translator?: ITranslator
  ): Promise<boolean> {
    translator = translator || nullTranslator;
    const trans = translator.load('jupyterlab');

    switch (cell.type) {
      case 'markdown':
        (cell as MarkdownCell).rendered = true;
        cell.inputHidden = false;
        executed.emit({ notebook, cell });
        break;
      case 'code':
        if (sessionContext) {
          if (sessionContext.isTerminating) {
            void showDialog({
              title: trans.__('Kernel Terminating'),
              body: trans.__(
                'The kernel for %1 appears to be terminating. You can not run any cell for now.',
                sessionContext.session?.path
              ),
              buttons: [Dialog.okButton({ label: trans.__('Ok') })]
            });
            break;
          }
          const deletedCells = notebook.model?.deletedCells ?? [];
          return CodeCell.execute(cell as CodeCell, sessionContext, {
            deletedCells,
            recordTiming: notebook.notebookConfig.recordTiming
          })
            .then(reply => {
              deletedCells.splice(0, deletedCells.length);
              if (cell.isDisposed) {
                return false;
              }

              if (!reply) {
                return true;
              }

              if (reply.content.status === 'ok') {
                const content = reply.content;

                if (content.payload && content.payload.length) {
                  handlePayload(content, notebook, cell);
                }

                return true;
              } else {
                throw new Error('KernelReplyNotOK');
              }
            })
            .catch(reason => {
              if (cell.isDisposed || reason.message.startsWith('Canceled')) {
                return false;
              }
              throw reason;
            })
            .then(ran => {
              if (ran) {
                executed.emit({ notebook, cell });
              }

              return ran;
            });
        }
        // (cell.model as ICodeCellModel).clearExecution();
        break;
      default:
        break;
    }

    return Promise.resolve(true);
  }

  /**
   * Handle payloads from an execute reply.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](https://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  function handlePayload(
    content: KernelMessage.IExecuteReply,
    notebook: Notebook,
    cell: Cell
  ) {
    const setNextInput = content.payload?.filter(i => {
      return (i as any).source === 'set_next_input';
    })[0];

    if (!setNextInput) {
      return;
    }

    const text = setNextInput.text as string;
    const replace = setNextInput.replace;

    if (replace) {
      cell.model.value = text;
      return;
    }

    // Create a new code cell and add as the next cell.
    const newCell = notebook.model.contentFactory.createCodeCell();
    let index = ArrayExt.firstIndexOf(notebook.widgets, cell);
    index = index === -1 ? notebook.widgets.length : index;
    const { datastore, record, cells } = notebook.model.data;
    DatastoreExt.withTransaction(datastore, () => {
      DatastoreExt.updateField(
        datastore,
        { ...record, field: 'cells' },
        { index, remove: 0, values: [newCell] }
      );
      DatastoreExt.updateField(
        datastore,
        { ...cells, record: newCell, field: 'text' },
        { index: 0, remove: 0, text }
      );
    });
  }

  /**
   * Copy or cut the selected cell data to the application clipboard.
   *
   * @param notebook - The target notebook widget.
   *
   * @param cut - Whether to copy or cut.
   */
  export function copyOrCut(notebook: Notebook, cut: boolean): void {
    if (!notebook.model || !notebook.activeCell) {
      return;
    }

    const state = getState(notebook);
    const clipboard = Clipboard.getInstance();

    notebook.mode = 'command';
    clipboard.clear();

    const data = notebook.widgets
      .filter(cell => notebook.isSelectedOrActive(cell))
      .map(cell => CellData.toJSON(cell.data))
      .map(cellJSON => {
        if ((cellJSON.metadata as JSONObject).deletable !== undefined) {
          delete (cellJSON.metadata as JSONObject).deletable;
        }
        return cellJSON;
      });

    clipboard.setData(JUPYTER_CELL_MIME, data);
    if (cut) {
      deleteCells(notebook);
    } else {
      notebook.deselectAll();
    }
    handleState(notebook, state);
  }

  /**
   * Change the selected cell type(s).
   *
   * @param notebook - The target notebook widget.
   *
   * @param value - The target cell type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any cells converted to markdown will be unrendered.
   */
  export function changeCellType(
    notebook: Notebook,
    value: nbformat.CellType
  ): void {
    const model = notebook.model!;
    const index = notebook.activeCellIndex;

    const { datastore, record } = model.data;
    DatastoreExt.withTransaction(datastore, () => {
      notebook.widgets.forEach((child, index) => {
        if (!notebook.isSelectedOrActive(child)) {
          return;
        }
        cells.set(index, newCell);
      }
        if (child.type !== value) {
          let cellId = '';
          let cell = CellData.toJSON(child.data);
          if (cell.type === 'code') {
            // When we convert to another cell type,
            // make sure it is flagged as untrusted.
            cell['metadata']['trusted'] = false;
          }
          switch (value) {
            case 'code':
              cellId = model.contentFactory.createCodeCell(
                cell as nbformat.ICodeCell
              );
              break;
            case 'markdown':
              cellId = model.contentFactory.createMarkdownCell(
                cell as nbformat.IMarkdownCell
              );
              break;
            default:
              cellId = model.contentFactory.createRawCell(
                cell as nbformat.IRawCell
              );
              break;
          }
          DatastoreExt.updateField(
            datastore,
            { ...record, field: 'cells' },
            { index, remove: 1, values: [cellId] }
          );
        }
      });
    });
    // TODO: unrender the new markdown cells.
    notebook.activeCellIndex = index;
  }

  /**
   * Delete the selected cells.
   *
   * @param notebook - The target notebook widget.
   *
   * #### Notes
   * The cell after the last selected cell will be activated.
   * If the last cell is deleted, then the previous one will be activated.
   * It will add a code cell if all cells are deleted.
   * This action can be undone.
   */
  export function deleteCells(notebook: Notebook): void {
    const model = notebook.model!;
    const toDelete: number[] = [];

    notebook.mode = 'command';

    // Find the cells to delete.
    notebook.widgets.forEach((child, index) => {
      const { datastore, record } = child.data;
      const metadata = DatastoreExt.getField(datastore, {
        ...record,
        field: 'metadata'
      });
      const deletable = metadata['deletable'] !== false;

      if (notebook.isSelectedOrActive(child) && deletable) {
        toDelete.push(index);
        notebook.model.deletedCells.push(child.data.record.record);
      }
    });

    // If cells are not deletable, we may not have anything to delete.
    if (toDelete.length > 0) {
      const { datastore, record } = model.data;
      DatastoreExt.withTransaction(datastore, () => {
        // Delete cells in reverse order to maintain the correct indices.
        toDelete.reverse().forEach(index => {
          DatastoreExt.updateField(
            datastore,
            { ...record, field: 'cells' },
            { index, remove: 1, values: [] }
          );
        });
        // Add a new cell if the notebook is empty. This is done
        // within the compound operation to make the deletion of
        // a notebook's last cell undoable.
        if (toDelete.length === notebook.widgets.length) {
          const cellId = model.contentFactory.createCell(
            notebook.notebookConfig.defaultCell
          );
          DatastoreExt.updateField(
            datastore,
            { ...record, field: 'cells' },
            { index: 0, remove: 0, values: [cellId] }
          );
        }
      });

      // Select the *first* interior cell not deleted or the cell
      // *after* the last selected cell.
      // Note: The activeCellIndex is clamped to the available cells,
      // so if the last cell is deleted the previous cell will be activated.
      // The *first* index is the index of the last cell in the initial
      // toDelete list due to the `reverse` operation above.
      notebook.activeCellIndex = toDelete[0] - toDelete.length + 1;
    }

    // Deselect any remaining, undeletable cells. Do this even if we don't
    // delete anything so that users are aware *something* happened.
    notebook.deselectAll();
  }

  /**
   * Set the markdown header level of a cell.
   */
  export function setMarkdownHeader(cell: Cell, level: number) {
   // Remove existing header or leading white space.
    let source = cell.editor.model.value;
    const regex = /^(#+\s*)|^(\s*)/;
    const newHeader = Array(level + 1).join('#') + ' ';
    const matches = regex.exec(source);

    if (matches) {
      source = source.slice(matches[0].length);
    }
    cell.editor.model.value = newHeader + source;
  }
}
