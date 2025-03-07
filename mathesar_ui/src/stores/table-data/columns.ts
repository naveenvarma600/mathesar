import type { Writable, Updater, Subscriber, Unsubscriber } from 'svelte/store';
import { writable, get as getStoreValue } from 'svelte/store';
import type { DBObjectEntry, DbType } from '@mathesar/App.d';
import type { CancellablePromise } from '@mathesar-component-library';
import { EventHandler } from '@mathesar-component-library';
import type { PaginatedResponse } from '@mathesar/utils/api';
import {
  deleteAPI,
  getAPI,
  patchAPI,
  postAPI,
  States,
} from '@mathesar/utils/api';
import { TabularType } from './TabularType';
import type { Meta } from './meta';

export interface Column {
  id: number;
  name: string;
  type: DbType;
  type_options: Record<string, unknown> | null;
  display_options: Record<string, unknown> | null;
  index: number;
  nullable: boolean;
  primary_key: boolean;
  valid_target_types: DbType[];
  __columnIndex?: number;
}

export interface ColumnsData {
  state: States;
  error?: string;
  columns: Column[];
  primaryKeyColumnId?: number;
}

function preprocessColumns(response?: Column[]): Column[] {
  let index = 0;
  return (
    response?.map((column) => {
      const newColumn = {
        ...column,
        __columnIndex: index,
      };
      index += 1;
      return newColumn;
    }) || []
  );
}

function api(url: string) {
  return {
    get() {
      return getAPI<PaginatedResponse<Column>>(`${url}?limit=500`);
    },
    add(columnDetails: Partial<Column>) {
      return postAPI<Partial<Column>>(url, columnDetails);
    },
    remove(id: Column['id']) {
      return deleteAPI(`${url}${id}/`);
    },
    update(id: Column['id'], data: Partial<Column>) {
      return patchAPI<Partial<Column>>(`${url}${id}/`, data);
    },
  };
}

export class ColumnsDataStore
  extends EventHandler
  implements Writable<ColumnsData>
{
  private type: TabularType;

  private parentId: DBObjectEntry['id'];

  private store: Writable<ColumnsData>;

  private promise: CancellablePromise<PaginatedResponse<Column>> | undefined;

  private api: ReturnType<typeof api>;

  private meta: Meta;

  private fetchCallback: (storeData: ColumnsData) => void;

  constructor(
    type: TabularType,
    parentId: number,
    meta: Meta,
    fetchCallback: (storeData: ColumnsData) => void = () => {},
  ) {
    super();
    this.type = type;
    this.parentId = parentId;
    this.store = writable({
      state: States.Loading,
      columns: [],
      primaryKey: undefined,
    });
    this.meta = meta;
    const tabularEntity = this.type === TabularType.Table ? 'tables' : 'views';
    this.api = api(`/api/db/v0/${tabularEntity}/${this.parentId}/columns/`);
    this.fetchCallback = fetchCallback;
    void this.fetch();
  }

  set(value: ColumnsData): void {
    this.store.set(value);
  }

  update(updater: Updater<ColumnsData>): void {
    this.store.update(updater);
  }

  subscribe(run: Subscriber<ColumnsData>): Unsubscriber {
    return this.store.subscribe(run);
  }

  get(): ColumnsData {
    return getStoreValue(this.store);
  }

  getColumnsByIds(ids: Column['id'][]): Column[] {
    return this.get().columns.filter((column) => ids.includes(column.id));
  }

  async fetch(): Promise<ColumnsData | undefined> {
    this.update((existingData) => ({
      ...existingData,
      state: States.Loading,
    }));

    try {
      this.promise?.cancel();
      this.promise = this.api.get();

      const response = await this.promise;
      const columnResponse = preprocessColumns(response.results);
      const pkColumn = columnResponse.find((column) => column.primary_key);

      const storeData: ColumnsData = {
        state: States.Done,
        columns: columnResponse,
        primaryKeyColumnId: pkColumn?.id,
      };
      this.set(storeData);
      this.fetchCallback?.(storeData);
      return storeData;
    } catch (err) {
      this.set({
        state: States.Error,
        error: err instanceof Error ? err.message : undefined,
        columns: [],
        primaryKeyColumnId: undefined,
      });
    } finally {
      this.promise = undefined;
    }
    return undefined;
  }

  async add(columnDetails: Partial<Column>): Promise<Partial<Column>> {
    const column = await this.api.add(columnDetails);
    await this.fetch();
    return column;
  }

  async rename(id: Column['id'], newName: string): Promise<void> {
    await this.api.update(id, { name: newName });
    await this.dispatch('columnRenamed', id);
  }

  async setNullabilityOfColumn(
    column: Column,
    nullable: boolean,
  ): Promise<void> {
    if (column.primary_key) {
      throw new Error(
        `Column "${column.name}" cannot allow NULL because it is a primary key.`,
      );
    }
    await this.api.update(column.id, { nullable });
    await this.fetch();
  }

  // TODO: Analyze: Might be cleaner to move following functions as a property of Column class
  // but are the object instantiations worth it?

  async patchType(
    columnId: Column['id'],
    type: Column['type'],
    type_options: Column['type_options'],
    display_options: Column['display_options'],
  ): Promise<Partial<Column>> {
    const column = await this.api.update(columnId, {
      type,
      type_options,
      display_options,
    });
    await this.fetch();
    await this.dispatch('columnPatched', column);
    return column;
  }

  destroy(): void {
    this.promise?.cancel();
    this.promise = undefined;
    super.destroy();
  }

  async deleteColumn(columnId: Column['id']): Promise<void> {
    await this.api.remove(columnId);
    await this.fetch();
  }
}
