// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Schema, Datastore } from '@lumino/datastore';

import { CollaborationClient } from './client';
import { PageConfig } from '@jupyterlab/coreutils';

export async function createDatastore(
  collaborationId: string,
  schemas: ReadonlyArray<Schema>
): Promise<Datastore> {
  const client = new CollaborationClient({
    collaborationId: collaborationId
  });
  // TODO(RTC) broadcastHandler: client
  const datastore = Datastore.create({
    id: PageConfig.getStoreID(),
    schemas: schemas,
    adapter: client
  });
  client.handler = datastore;
  // Wait for websocket connection to be ready
  await client.ready;
  await client.replayHistory();
  return datastore;
}
