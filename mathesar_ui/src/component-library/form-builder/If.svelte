<script lang="ts">
  import { computeIfElements } from './utils';
  import type { FormInputStore, ConditionalIfElement } from './types';

  export let store: FormInputStore;
  export let condition: ConditionalIfElement['condition'] = 'eq';
  export let value: ConditionalIfElement['value'];
  export let elements: ConditionalIfElement['elements'];

  $: elementsToDisplay = computeIfElements($store, {
    condition,
    value,
    elements,
  });
</script>

{#each elementsToDisplay as element (element)}
  <slot {element} />
{/each}
