import { toValue, type MaybeRefOrGetter } from '@vueuse/core';
import { findKey, get, some } from 'lodash';
import { computed, ref, watch } from 'vue-demi';

import type { UnknownRecord } from '@/shared/types';
import { useWatchStopHandlers } from './utils';

import type { Get, NonEmptyObject, Paths, RequireAtLeastOne } from 'type-fest';

type Data = UnknownRecord<string>;

type StringPaths<ObjectData extends Data> = Paths<ObjectData> extends string
  ? Paths<ObjectData>
  : never;

type Message<Value> = ((value: Value) => string) | string;

type UseValidateRule<Value> = RequireAtLeastOne<{
  test?: (value: Value) => boolean
  message?: Message<Value>
}>;

type UseValidateRulesByPath<
  ValidationData extends Data,
  Path extends StringPaths<ValidationData>,
> = Record<string, UseValidateRule<Get<ValidationData, Path>>>;

type UseValidateRules<ValidationData extends Data> = NonEmptyObject<{
  [Path in StringPaths<ValidationData>]?: UseValidateRulesByPath<ValidationData, Path>
}>;

type ValidationPaths<
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>,
> = keyof ValidationRules extends StringPaths<ValidationData>
  ? keyof ValidationRules
  : never;

type UseValidateErrors<
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData> = UseValidateRules<ValidationData>,
> = {
  [Path in ValidationPaths<ValidationData, ValidationRules>]: {
    [RuleName in keyof ValidationRules[Path]]: ValidationRules[Path][RuleName] extends { message: Message<never> }
      ? { rule: RuleName, message: string }
      : { rule: RuleName }
  }[keyof ValidationRules[Path]] | null
};

interface UseValidateOptions {
  eager?: boolean
  immediate?: boolean
}

const DEFAULT_OPTIONS = {
  eager: false,
  immediate: false,
} satisfies UseValidateOptions;

const useValidate = <
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>,
>(
  data: MaybeRefOrGetter<ValidationData>,
  rules: MaybeRefOrGetter<ValidationRules>,
  options?: UseValidateOptions,
) => {
  const errors = ref({} as UseValidateErrors<ValidationData, ValidationRules>);

  const hasError = computed(() => some(errors.value, Boolean));

  const paths = computed(() => Object.keys(toValue(rules)) as ValidationPaths<ValidationData, ValidationRules>[]);

  const getValue = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ): Get<ValidationData, Path> => get(toValue(data), path);

  const getErrorEntry = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
    ruleName: keyof ValidationRules[Path],
  ) => {
    const rulesByPath = toValue(rules)[path];
    if (!rulesByPath) {
      console.warn(`No rules found for path "${path}"`);

      return undefined;
    }

    const rule = rulesByPath[ruleName] as UseValidateRule<Get<ValidationData, Path>> | undefined;

    if (!rule) {
      console.warn(`No rule "${String(ruleName)}" found for path "${path}"`);

      return undefined;
    }

    const rawMessage = rule.message;
    const errorMessage = typeof rawMessage === 'function'
      ? rawMessage(getValue(path))
      : rawMessage;

    return {
      rule: ruleName,
      message: errorMessage,
    };
  };

  const {
    setWatchStopHandler: setErrorEntryWatchStopHandler,
    deleteWatchStopHandler: deleteErrorEntryWatchStopHandler,
  } = useWatchStopHandlers();

  const setError = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
    ruleName: keyof ValidationRules[Path],
  ) => {
    const errorEntryWatchStopHandler = watch(
      () => getErrorEntry(path, ruleName),
      (errorMessage) => {
        errors.value[path] = errorMessage;
      },
      { immediate: true },
    );

    setErrorEntryWatchStopHandler(path, errorEntryWatchStopHandler);
  };

  const clearError = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ) => {
    errors.value[path] = null;
    deleteErrorEntryWatchStopHandler(path);
  };

  const clearAllErrors = () => {
    for (const path of paths.value) {
      clearError(path);
    }
  };

  const validateField = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ) => {
    const value = getValue(path);
    const rulesByPath = toValue(rules)[path] as UseValidateRulesByPath<ValidationData, Path>;
    const ruleName = findKey(rulesByPath, (rule) => (
      rule.test?.(value) ?? false
    )) as keyof ValidationRules[Path] | undefined;

    if (ruleName) {
      setError(path, ruleName);
    } else {
      clearError(path);
    }

    return !ruleName;
  };

  const validateAllFields = () => {
    for (const path of paths.value) {
      validateField(path);
    }

    return !hasError.value;
  };

  const createFieldWatcher = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ) => {
    watch(
      () => getValue(path),
      () => validateField(path),
      { deep: true },
    );
  };

  const createAllFieldsWatchers = () => {
    for (const path of paths.value) {
      createFieldWatcher(path);
    }
  };

  const init = () => {
    const { eager, immediate } = { ...DEFAULT_OPTIONS, ...options };

    // put change tracking on all `data` fields described in `rules`
    if (eager) {
      createAllFieldsWatchers();
    }

    // validation of all fields from `data` described in `rules` during initialization
    if (immediate) {
      validateAllFields();
      return;
    }

    // fill in `errors` if there was no immediate validation
    clearAllErrors();
  };

  init();

  return {
    errors: computed(() => errors.value as UseValidateErrors<ValidationData, ValidationRules>),
    hasError,
    setError,
    clearError,
    clearAllErrors,
    validateField,
    validateAllFields,
  };
};

export {
  useValidate,
  type UseValidateErrors,
  type UseValidateRule,
  type UseValidateRules,
  type UseValidateOptions,
};
