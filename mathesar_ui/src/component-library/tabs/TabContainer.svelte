<script lang="ts" context="module">
  let id = 0;

  function getId() {
    id += 1;
    return id;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TabComponent from './Tab.svelte';
  import type { Tab } from './TabContainer';

  const dispatch = createEventDispatcher();
  const componentId = getId();

  export let tabs: Tab[] = [];
  export let activeTab: Tab = tabs[0];
  export let idKey = 'id';
  export let labelKey = 'label';
  export let linkKey = 'href';
  export let allowRemoval = false;
  export let preventDefault = false;
  export let getLink: (arg0: unknown) => string;

  function selectActiveTab(e: Event, tab: Tab) {
    activeTab = tab;
    dispatch('tabSelected', {
      tab,
      originalEvent: e,
    });
  }

  function removeTab(e: { detail: Event }, index: number) {
    const removedTab = tabs.splice(index, 1);
    if (activeTab[idKey] === removedTab[0]?.[idKey]) {
      if (tabs[index]) {
        activeTab = tabs[index];
      } else if (tabs[index - 1]) {
        activeTab = tabs[index - 1];
      } else {
        // @ts-ignore: https://github.com/centerofci/mathesar/issues/1055
        activeTab = null;
      }
    }
    tabs = ([] as Tab[]).concat(tabs);
    dispatch('tabRemoved', {
      removedTab: removedTab[0],
      activeTab,
      originalEvent: e.detail,
    });
  }

  function focusTab(e: Event) {
    // @ts-ignore: https://github.com/centerofci/mathesar/issues/1055
    (e.target as Node).parentElement.classList.add('focused');
  }

  function blurTab(e: Event) {
    // @ts-ignore: https://github.com/centerofci/mathesar/issues/1055
    (e.target as Node).parentElement.classList.remove('focused');
  }

  function checkAndPreventDefault(e: Event) {
    if (preventDefault) {
      e.preventDefault();
      const tab = (e.target as HTMLElement).closest('a[role="tab"]');
      (tab as HTMLElement)?.focus?.();
    }
  }

  function getTabURL(tab: Tab): string {
    // @ts-ignore: https://github.com/centerofci/mathesar/issues/1055
    return getLink ? getLink(tab) : (tab[linkKey] as string) || null;
  }
</script>

<div class="tab-container" role="navigation">
  <ul role="tablist" class="tabs">
    {#each tabs as tab, index (tab[idKey] || tab)}
      <TabComponent
        {componentId}
        {tab}
        {allowRemoval}
        totalTabs={tabs.length}
        {getTabURL}
        isActive={tab[idKey] === activeTab[idKey]}
        on:focus={focusTab}
        on:blur={blurTab}
        on:click={checkAndPreventDefault}
        on:mousedown={(e) => selectActiveTab(e, tab)}
        on:remove={(e) => removeTab(e, index)}
      >
        <slot name="tab" {tab}>
          {tab[labelKey]}
        </slot>
      </TabComponent>
    {/each}
  </ul>

  <div class="tab-content-holder">
    <div
      role="tabpanel"
      aria-hidden="false"
      id="mtsr-{componentId}-tabpanel"
      aria-labelledby="mtsr-{componentId}-tab"
      tabindex="0"
    >
      {#if activeTab}
        <slot />
      {/if}
    </div>
  </div>
</div>
