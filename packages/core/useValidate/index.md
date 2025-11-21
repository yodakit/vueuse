# useValidate

Предоставляет возможность валидации ключей объекта по заданным правилам.

Типизацию аргумента `rules`, объявленного через переменную, следует выполнять с использованием оператора `satisfies`. Это гарантирует корректное формирование типа для `errors`, содержащего только те поля, которые определены в `rules`.

## Usage

```typescript
import { useValidate, UseValidateRules } from '@tc/vue-utils/composables';

const PHONE_NUMBER_SYMBOLS_REGEX = /^[0-9()\-+\s]+$/;

const data = ref({
  name: '',
  tel: '',
  location: {
    country: ''
  },
});

const rules = {
  name: {
    empty: {
      message: 'Name is required',
      test: (value) => value !== '',
    },
    alreadyExists: {
      message: 'Name already exists',
    },
  },
  tel: {
    invalid: {
      message: (value) => `Invalid characters: ${value.replace(PHONE_NUMBER_SYMBOLS_REGEX, '')}`,
      test: (value) => !value || !PHONE_NUMBER_SYMBOLS_REGEX.test(value),
    },
  },
  'location.country': {
    empty: {
      message: 'Name is required',
      test: (value) => value !== '',
    },
  },
} satisfies UseValidateRules<typeof INITIAL_DATA>;

const { errors } = useValidate(data, rules)
```

## Type declarations

```typescript
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

declare const useValidate: <
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>
>(
  data: MaybeRefOrGetter<ValidationData>,
  rules: MaybeRefOrGetter<ValidationRules>,
  options?: UseValidateOptions
): UseValidateReturn<ValidationData, ValidationRules> => {
    errors: ComputedRef<UseValidateErrors<ValidationData, ValidationRules>>;
    hasError: ComputedRef<boolean>;
    setError: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path, ruleName: keyof ValidationRules[Path]) => void;
    clearError: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path) => void;
    clearAllErrors: () => void;
    validateField: <Path extends ValidationPaths<ValidationData, ValidationRules>>(path: Path) => boolean;
    validateAllFields: () => boolean;
};

export {
  useValidate,
  UseValidateErrors,
  UseValidateRule,
  UseValidateRules,
  UseValidateOptions
};
```
