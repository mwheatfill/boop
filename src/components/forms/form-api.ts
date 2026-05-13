import type {
  FormAsyncValidateOrFn,
  FormValidateOrFn,
  ReactFormExtendedApi,
} from '@tanstack/react-form'

export type FormApiFor<T> = ReactFormExtendedApi<
  T,
  FormValidateOrFn<T> | undefined,
  FormValidateOrFn<T> | undefined,
  FormAsyncValidateOrFn<T> | undefined,
  FormValidateOrFn<T> | undefined,
  FormAsyncValidateOrFn<T> | undefined,
  FormValidateOrFn<T> | undefined,
  FormAsyncValidateOrFn<T> | undefined,
  FormValidateOrFn<T> | undefined,
  FormAsyncValidateOrFn<T> | undefined,
  FormAsyncValidateOrFn<T> | undefined,
  unknown
>
