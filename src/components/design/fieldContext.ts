import type { ComputedRef, InjectionKey } from 'vue'

export interface FieldContext {
  labelId: string
  descriptionId: ComputedRef<string | undefined>
  invalid: ComputedRef<boolean>
}

export const fieldContextKey: InjectionKey<FieldContext> = Symbol('alpha-field')
