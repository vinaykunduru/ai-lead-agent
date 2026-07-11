declare module "franc-min" {
  export function franc(
    value: string,
    options?: { minLength?: number; only?: string[]; ignore?: string[] },
  ): string;
}
