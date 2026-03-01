<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import type { LLMModel } from 'src/ts/model/types';
    import { customComponents } from 'src/ts/setting/customComponents';
    import { language } from 'src/lang';
    import { DBState } from 'src/ts/stores.svelte';
    import { getModelInfo } from 'src/ts/model/modellist';
    import Check from 'src/lib/UI/GUI/CheckInput.svelte';
    import TextInput from 'src/lib/UI/GUI/TextInput.svelte';
    import NumberInput from 'src/lib/UI/GUI/NumberInput.svelte';
    import TextAreaInput from 'src/lib/UI/GUI/TextAreaInput.svelte';
    import SliderInput from 'src/lib/UI/GUI/SliderInput.svelte';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import SegmentedControl from 'src/lib/UI/GUI/SegmentedControl.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import ColorInput from 'src/lib/UI/GUI/ColorInput.svelte';
    import Button from 'src/lib/UI/GUI/Button.svelte';
    import Help from 'src/lib/Others/Help.svelte';
    import Accordion from 'src/lib/UI/Accordion.svelte';
    import Self from './SettingRenderer.svelte';

    interface Props {
        items: SettingItem[];
        /** Optional modelInfo, derived automatically if not provided */
        modelInfo?: LLMModel;
        /** Optional subModelInfo, derived automatically if not provided */
        subModelInfo?: LLMModel;
    }

    let { items, modelInfo, subModelInfo }: Props = $props();

    // Derive modelInfo if not provided
    let effectiveModelInfo = $derived(modelInfo ?? getModelInfo(DBState.db.aiModel));
    let effectiveSubModelInfo = $derived(subModelInfo ?? getModelInfo(DBState.db.subModel));

    // Build context for condition checks
    let ctx: SettingContext = $derived({
        db: DBState.db,
        modelInfo: effectiveModelInfo,
        subModelInfo: effectiveSubModelInfo,
    });

    function getLabel(item: SettingItem): string {
        if (item.labelKey && language[item.labelKey]) {
            return language[item.labelKey];
        }
        return item.fallbackLabel ?? '';
    }

    /**
     * Check if item should be visible based on condition
     */
    function checkCondition(item: SettingItem): boolean {
        if (!item.condition) return true;
        return item.condition(ctx);
    }

    /**
     * When a select or segmented control has conditional options, reset the value if it no longer matches any visible option
     * It selects last selectable entry when reset happens
     */
    $effect(() => {
        for (const item of items) {
            if (item.type === 'select' && item.options?.selectOptions && checkCondition(item)) {
                const filteredOpts = item.options.selectOptions.filter(opt => !opt.condition || opt.condition(ctx));
                const currentVal = (DBState.db as any)[item.bindKey];
                if (filteredOpts.length > 0 && !filteredOpts.some(o => o.value === currentVal)) {
                    (DBState.db as any)[item.bindKey] = filteredOpts[filteredOpts.length - 1].value;
                }
            } else if (item.type === 'segmented' && item.options?.segmentOptions && checkCondition(item)) {
                const filteredOpts = item.options.segmentOptions.filter(opt => !opt.condition || opt.condition(ctx));
                const currentVal = (DBState.db as any)[item.bindKey];
                if (filteredOpts.length > 0 && !filteredOpts.some(o => o.value === currentVal)) {
                    (DBState.db as any)[item.bindKey] = filteredOpts[filteredOpts.length - 1].value;
                }
            }
        }
    });

    /**
     * Get value from nested path (e.g., 'ooba.top_p')
     */
    function getBindValue(item: SettingItem): any {
        if (item.bindPath) {
            const parts = item.bindPath.split('.');
            let value: any = DBState.db;
            for (const part of parts) {
                value = value?.[part];
            }
            return value;
        }
        return (DBState.db as any)[item.bindKey];
    }

    /**
     * Set value to nested path (e.g., 'ooba.top_p')
     */
    function setBindValue(item: SettingItem, newValue: any): void {
        if (item.bindPath) {
            const parts = item.bindPath.split('.');
            let obj: any = DBState.db;
            for (let i = 0; i < parts.length - 1; i++) {
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = newValue;
        } else if (item.bindKey) {
            (DBState.db as any)[item.bindKey] = newValue;
        }
    }
</script>

{#each items as item (item.id)}
    {#if checkCondition(item)}
        {#if item.type === 'header'}
            {#if item.options?.level === 'h2'}
                <h2 class="mb-2 text-2xl font-bold mt-2 {item.classes ?? ''}">{getLabel(item)}</h2>
            {:else if item.options?.level === 'warning'}
                <span class="text-draculared text-xs mb-2 {item.classes ?? ''}">{getLabel(item)}</span>
            {:else}
                <span class="text-textcolor mt-4 mb-2 {item.classes ?? ''}">{getLabel(item)}</span>
            {/if}
        {:else if item.type === 'check'}
            <div class="flex items-center {item.classes ?? 'mt-2'}">
                <Check bind:check={(DBState.db as any)[item.bindKey]} name={getLabel(item)}>
                    {#if item.showExperimental}<Help key="experimental"/>{/if}
                    {#if item.helpKey}<Help key={item.helpKey as any} unrecommended={item.helpUnrecommended ?? false}/>{/if}
                </Check>
            </div>
        {:else if item.type === 'text'}
            <span class="text-textcolor {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            <TextInput
                marginBottom={true}
                size="sm"
                bind:value={(DBState.db as any)[item.bindKey]}
                placeholder={item.options?.placeholder}
                hideText={item.options?.hideText}
            />
        {:else if item.type === 'number'}
            <span class="text-textcolor {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            <NumberInput
                marginBottom={true}
                size="sm"
                min={item.options?.min}
                max={item.options?.max}
                bind:value={(DBState.db as any)[item.bindKey]}
            />
        {:else if item.type === 'textarea'}
            <span class="text-textcolor {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            <TextAreaInput
                bind:value={(DBState.db as any)[item.bindKey]}
                placeholder={item.options?.placeholder}
            />
        {:else if item.type === 'slider'}
            <span class="text-textcolor {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            {@const _sliderMult = item.options?.multiple ?? 1}
            {@const val = (DBState.db as any)[item.bindKey]}
            {@const _sliderDisabled = val === -1000 || val === undefined}
            <div class="flex gap-2 items-center mb-4">
                <div class="flex-1">
                    <SliderInput 
                        min={item.options?.min} 
                        max={item.options?.max}
                        step={item.options?.step}
                        fixed={item.options?.fixed}
                        multiple={item.options?.multiple}
                        disableable={item.options?.disableable}
                        customText={item.options?.customText}
                        bind:value={(DBState.db as any)[item.bindKey]}
                    />
                </div>
                <input
                    type="number"
                    value={_sliderDisabled ? '' : ((val ?? 0) * _sliderMult).toFixed(item.options?.fixed ?? 0)}
                    disabled={_sliderDisabled}
                    min={item.options?.min !== undefined ? item.options.min * _sliderMult : undefined}
                    max={item.options?.max !== undefined ? item.options.max * _sliderMult : undefined}
                    step={item.options?.step !== undefined ? item.options.step * _sliderMult : _sliderMult}
                    onchange={(e) => {
                        const v = parseFloat(e.currentTarget.value);
                        if (!isNaN(v)) {
                            const { min = -Infinity, max = Infinity, step = 1 } = item.options ?? {};
                            const precision = item.options?.fixed ?? 0;
                            const raw = v / _sliderMult;
                            const rounded = parseFloat((Math.round(raw / step) * step).toFixed(precision));
                            (DBState.db as any)[item.bindKey] = Math.min(Math.max(rounded, min), max);
                        } else {
                            e.currentTarget.value = _sliderDisabled ? '' : ((val ?? 0) * _sliderMult).toFixed(item.options?.fixed ?? 0);
                        }
                    }}
                    class="border border-darkborderc focus:border-borderc rounded-md bg-transparent focus:ring-borderc focus:ring-2 focus:outline-hidden transition-colors duration-200 text-sm text-textcolor disabled:text-textcolor2 px-2 py-1 w-20 shrink-0"
                />
            </div>
        {:else if item.type === 'select'}
            <span class="text-textcolor {item.classes ?? 'mt-4'}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            <SelectInput bind:value={(DBState.db as any)[item.bindKey]}>
                {#each (item.options?.selectOptions ?? []).filter(opt => !opt.condition || opt.condition(ctx)) as opt}
                    <OptionInput value={opt.value}>{opt.label}</OptionInput>
                {/each}
            </SelectInput>
        {:else if item.type === 'segmented'}
            <span class="text-textcolor {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
            </span>
            <SegmentedControl
                bind:value={(DBState.db as any)[item.bindKey]}
                options={(item.options?.segmentOptions ?? []).filter(opt => !opt.condition || opt.condition(ctx))}
            />
        {:else if item.type === 'color'}
            <div class="flex items-center {item.classes ?? 'mt-2'}">
                <ColorInput bind:value={(DBState.db as any)[item.bindKey]} />
                <span class="ml-2">{getLabel(item)}</span>
            </div>
        {:else if item.type === 'button'}
            <Button 
                className={item.classes ?? 'mt-4'}
                onclick={item.options?.onClick}
            >
                {getLabel(item)}
            </Button>
        {:else if item.type === 'accordion'}
            <Accordion name={getLabel(item)} styled={item.options?.styled ?? false}>
                {#if item.options?.children}
                    <Self items={item.options.children} {modelInfo} {subModelInfo} />
                {/if}
            </Accordion>
        {:else if item.type === 'custom' && item.componentId}
            {@const CustomComponent = customComponents[item.componentId]}
            {#if CustomComponent}
                <CustomComponent {...item.componentProps} />
            {/if}
        {/if}
    {/if}
{/each}

