/* eslint-disable jsdoc/require-param-type */
import { findKey, get, isFunction, some } from 'lodash';
import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue-demi';

import type { UnknownRecord } from '@/shared/types';
import { useWatchStopHandlers } from './utils';

import type { Get, NonEmptyObject, Paths, RequireAtLeastOne } from 'type-fest';

type Data = UnknownRecord<string>;

type StringPaths<ObjectData extends Data> = Paths<ObjectData> extends string
  ? Paths<ObjectData>
  : never;

type Message<Value> = ((value: Value) => string) | MaybeRefOrGetter<string>;

type UseValidateRule<Value> = RequireAtLeastOne<{
  message?: Message<Value>
  /**
   * The test function to validate the value.
   *
   * @param value - The value to validate
   * @returns `true` if the value is valid, `false` otherwise
   */
  test?: (value: Value) => boolean
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
    [RuleName in keyof ValidationRules[Path]]?: ValidationRules[Path][RuleName] extends { message: Message<never> }
      ? { rule: RuleName, message: string }
      : { rule: RuleName, message?: undefined }
  }[keyof ValidationRules[Path]]
};

interface UseValidateOptions {
  /**
   * Whether to enable reactive validation on changes of fields targeted by `rules`.
   *
   * @default false
   */
  eager?: boolean
  /**
   * Whether to run validation during initialization.
   *
   * @default false
   */
  immediate?: boolean
}

interface UseValidateReturn<ValidationData extends Data, ValidationRules extends UseValidateRules<ValidationData>> {
  /**
   * The reactive object of validation errors.
   * Keys are field paths defined in `rules`; values are objects with the failing rule name and message text.
   * If no error is present, the key is not included in the object.
   */
  errors: ComputedRef<UseValidateErrors<ValidationData, ValidationRules>>
  /**
   * Whether any field currently has a validation error.
   */
  hasError: ComputedRef<boolean>
  /**
   * Manually sets an error for a specific field path and rule name.
   *
   * @param path - The field path to set the error for
   * @param ruleName - The name of the rule that caused the error
   */
  setError: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path, ruleName: keyof ValidationRules[Path]) => void
  /**
   * Clears the error for a specific field path.
   *
   * @param path - The field path to clear the error
   */
  clearError: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path) => void
  /**
   * Clears all errors.
   */
  clearAllErrors: () => void
  /**
   * Validates a specific field path.
   *
   * @param path - The field path to validate
   * @returns `true` if the field is valid, `false` otherwise
   */
  validateField: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path) => boolean
  /**
   * Validates all fields.
   *
   * @returns `true` if all fields are valid, `false` otherwise
   */
  validateAllFields: () => boolean
}

/**
 * Performs reactive validation and exposes current errors and validation helpers.
 *
 * @param data - The source object with fields to validate
 * @param rules - The validation rules mapped by field path. Use `satisfies` to ensure the correct type.
 * @param options
 */
const useValidate = <
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>,
>(
  data: MaybeRefOrGetter<ValidationData>,
  rules: ValidationRules,
  options?: UseValidateOptions,
): UseValidateReturn<ValidationData, ValidationRules> => {
  const errors = ref({} as UseValidateErrors<ValidationData, ValidationRules>);

  const hasError = computed(() => some(errors.value, Boolean));

  const paths = Object.keys(rules) as ValidationPaths<ValidationData, ValidationRules>[];

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

    const errorMessage = isFunction(rule.message)
      ? rule.message(getValue(path))
      : rule.message;

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
      (errorEntry) => {
        if (!errorEntry) return;

        errors.value[path] = {
          rule: errorEntry.rule,
          message: toValue(errorEntry.message),
        };
      },
      { immediate: true, deep: true },
    );

    setErrorEntryWatchStopHandler(path, errorEntryWatchStopHandler);
  };

  const clearError = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ) => {
    delete errors.value[path];
    deleteErrorEntryWatchStopHandler(path);
  };

  const clearAllErrors = () => {
    for (const path of paths) {
      clearError(path);
    }
  };

  const validateField = <Path extends ValidationPaths<ValidationData, ValidationRules>>(
    path: Path,
  ) => {
    const value = getValue(path);
    const rulesByPath = toValue(rules)[path] as UseValidateRulesByPath<ValidationData, Path>;
    const ruleName = findKey(rulesByPath, (rule) => (
      isFunction(rule.test) ? !rule.test(value) : false
    )) as keyof ValidationRules[Path] | undefined;

    if (ruleName) {
      setError(path, ruleName);
    } else {
      clearError(path);
    }

    return !ruleName;
  };

  const validateAllFields = () => {
    for (const path of paths) {
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
    for (const path of paths) {
      createFieldWatcher(path);
    }
  };

  const init = () => {
    const {
      eager = false,
      immediate = false,
    } = options ?? {};

    // put change tracking on all `data` fields described in `rules`
    if (eager) {
      createAllFieldsWatchers();
    }

    // validation of all fields from `data` described in `rules` during initialization
    if (immediate) {
      validateAllFields();
    }
  };

  init();

  return {
    errors: computed(() => errors.value),
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
  type UseValidateReturn,
};
