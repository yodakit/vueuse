import { test as baseTest } from 'vitest';
import { nextTick, ref } from 'vue';

import { withSetup } from '~/tests/utils';
import { useValidate, type UseValidateRules } from '.';

const createDataAndRules = (isValid = false) => {
  const data = ref({
    foo: 'foo',
    bar: {
      baz: 'baz',
    },
  });
  const rules = {
    foo: {
      invalid: {
        message: 'foo invalid',
        test: () => isValid,
      },
    },
    'bar.baz': {
      invalid: {
        message: 'baz invalid',
        test: () => isValid,
      },
    },
  } satisfies UseValidateRules<typeof data.value>;

  return {
    data,
    rules,
  };
};

const test = baseTest.extend<{
  validator: ReturnType<
    typeof useValidate<
      ReturnType<typeof createDataAndRules>['data']['value'],
      ReturnType<typeof createDataAndRules>['rules']
    >
  >
}>({
  validator: async ({ onTestFinished }, use) => {
    const { data, rules } = createDataAndRules();
    const [validator, app] = withSetup(() => useValidate(data, rules));

    await use(validator);

    onTestFinished(() => {
      app.unmount();
    });
  },
});

test('Нет ошибок, если заданные правила выполнены', () => {
  // Arrange
  const { data, rules } = createDataAndRules(true);

  // Act
  const validator = withSetup(() => useValidate(data, rules))[0];
  validator.validateAllFields();
  const { errors, hasError } = validator;

  // Assert
  expect(Object.values(errors.value).every((error) => error === null)).toBeTruthy();
  expect(hasError.value).toBeFalsy();
});

test('Ошибка устанавливается вручную', ({ validator }) => {
  // Act
  validator.setError('bar.baz', 'invalid');
  const { errors, hasError } = validator;

  // Assert
  expect(errors.value['bar.baz']?.rule).toBe('invalid');
  expect(errors.value['bar.baz']?.message).toBe('baz invalid');
  expect(hasError.value).toBeTruthy();
});

test('Нельзя установить ошибку для несуществующего поля', ({ validator }) => {
  // Arrange
  const nonExistentPath = 'path.not.exist';

  // Act
  // @ts-expect-error Передаем заведомо невалидный путь
  validator.setError(nonExistentPath, 'invalid');

  // Assert
  expect(`No rules found for path "${nonExistentPath}"`).toHaveBeenWarned();
});

test('Нельзя установить ошибку для несуществующего правила', ({ validator }) => {
  // Arrange
  const nonExistentRuleName = 'ruleNotExist';

  // Act
  // @ts-expect-error Передаем заведомо невалидное имя правила
  validator.setError('foo', nonExistentRuleName);

  // Assert
  expect(`No rule "${nonExistentRuleName}" found for path "foo"`).toHaveBeenWarned();
});

test('Отрабатывает корректно при передаче функции в качестве rule message', () => {
  // Arrange
  const data = ref({ foo: 'foo' });
  const rules = {
    foo: {
      invalid: {
        message: (value) => value,
        test: () => true,
      },
    },
  } satisfies UseValidateRules<typeof data.value>;

  // Act
  const validator = withSetup(() => useValidate(data, rules))[0];
  validator.setError('foo', 'invalid');
  const { errors } = validator;

  // Assert
  expect(errors.value.foo?.message).toBe('foo');
});

test('Допускает конфигурацию правила без указания сообщения', () => {
  // Arrange
  const data = ref({ foo: 'foo' });
  const rules = {
    foo: {
      invalid: {
        test: () => true,
      },
    },
  } satisfies UseValidateRules<typeof data.value>;

  // Act
  const validator = withSetup(() => useValidate(data, rules))[0];
  validator.setError('foo', 'invalid');
  const { errors } = validator;

  // Assert
  expect(errors.value.foo?.rule).toBe('invalid');
  expect(errors.value.foo?.message).toBeUndefined();
});

test('Валидирует отдельное поле', ({ validator }) => {
  // Act
  const isValid = validator.validateField('foo');
  const { errors, hasError } = validator;

  // Assert
  expect(errors.value.foo?.rule).toBe('invalid');
  expect(errors.value.foo?.message).toBe('foo invalid');
  expect(hasError.value).toBeTruthy();
  expect(isValid).toBeFalsy();
});

test('Валидирует все поля', ({ validator }) => {
  // Act
  const isValid = validator.validateAllFields();
  const { errors, hasError } = validator;

  // Assert
  expect(errors.value.foo?.rule).toBe('invalid');
  expect(errors.value.foo?.message).toBe('foo invalid');
  expect(errors.value['bar.baz']?.rule).toBe('invalid');
  expect(errors.value['bar.baz']?.message).toBe('baz invalid');
  expect(hasError.value).toBeTruthy();
  expect(isValid).toBeFalsy();
});

test('Очищает ошибку отдельного поля', ({ validator }) => {
  // Arrange
  validator.validateField('foo');
  const { errors, hasError } = validator;
  assert.equal(errors.value.foo?.rule, 'invalid');
  assert.equal(errors.value.foo?.message, 'foo invalid');
  assert.isTrue(hasError.value);

  // Act
  validator.clearError('foo');

  // Assert
  expect(validator.errors.value.foo).toBeUndefined();
  expect(hasError.value).toBeFalsy();
});

test('Очищает ошибки всех полей', ({ validator }) => {
  // Arrange
  validator.validateAllFields();
  const { errors, hasError } = validator;
  assert.equal(errors.value.foo?.rule, 'invalid');
  assert.equal(errors.value.foo?.message, 'foo invalid');
  assert.equal(errors.value['bar.baz']?.rule, 'invalid');
  assert.equal(errors.value['bar.baz']?.message, 'baz invalid');
  assert.isTrue(hasError.value);

  // Act
  validator.clearAllErrors();

  // Assert
  expect(validator.errors.value.foo).toBeUndefined();
  expect(validator.errors.value['bar.baz']).toBeUndefined();
  expect(hasError.value).toBeFalsy();
});

test('Опция immediate запускает валидацию немедленно', () => {
  // Arrange
  const { data, rules } = createDataAndRules();

  // Act
  const validator = withSetup(() => useValidate(data, rules, { immediate: true }))[0];
  const { errors, hasError } = validator;

  // Assert
  expect(errors.value.foo?.rule).toBe('invalid');
  expect(errors.value.foo?.message).toBe('foo invalid');
  expect(errors.value['bar.baz']?.rule).toBe('invalid');
  expect(errors.value['bar.baz']?.message).toBe('baz invalid');
  expect(hasError.value).toBeTruthy();
});

test('Опция eager валидирует поля повторно при изменении', async () => {
  // Arrange
  const { data, rules } = createDataAndRules();

  // Act
  const validator = withSetup(() => useValidate(data, rules, { eager: true }))[0];
  data.value.bar.baz = 'foo';
  await nextTick();
  const { errors, hasError } = validator;

  // Assert
  expect(errors.value['bar.baz']?.rule).toBe('invalid');
  expect(errors.value['bar.baz']?.message).toBe('baz invalid');
  expect(hasError.value).toBeTruthy();
});
