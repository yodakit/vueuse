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
      test: (value) => value === '',
    },
    alreadyExists: {
      message: 'Name already exists',
    },
  },
  tel: {
    invalid: {
      message: (value) => `Invalid characters: ${value.replace(PHONE_NUMBER_SYMBOLS_REGEX, '')}`,
      test: (value) => value && !PHONE_NUMBER_SYMBOLS_REGEX.test(value),
    },
  },
  'location.country': {
    empty: {
      message: 'Name is required',
      test: (value) => value === '',
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

type Message<Value> = ((value: Value) => string) | string;

interface UseValidateRule<Value> {
    test?: (value: Value) => boolean;
    message: Message<Value>;
}

type UseValidateRulesByPath<
  ValidationData extends Data,
  Path extends StringPaths<ValidationData>
> = Record<string, UseValidateRule<Get<ValidationData, Path>>>;

type UseValidateRules<ValidationData extends Data> = NonEmptyObject<{
    [Path in StringPaths<ValidationData>]?: UseValidateRulesByPath<ValidationData, Path>;
}>;

type ValidationPaths<
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>
> = keyof ValidationRules extends StringPaths<ValidationData>
  ? keyof ValidationRules
  : never;

type UseValidateErrors<
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData> = UseValidateRules<ValidationData>
> = Record<ValidationPaths<ValidationData, ValidationRules>, string | null>;

interface UseValidateOptions {
    eager?: boolean;
    immediate?: boolean;
}

declare const useValidate: <
  ValidationData extends Data,
  ValidationRules extends UseValidateRules<ValidationData>
>(
  data: MaybeRefOrGetter<ValidationData>,
  rules: MaybeRefOrGetter<ValidationRules>,
  options?: UseValidateOptions
) => {
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