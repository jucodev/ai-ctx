# Componentes UI, page components, custom hooks y formularios

## 1. Componentes UI — estructura multi-archivo (una carpeta por componente)

```
components/ProductCard/
├── ProductCard.component.tsx   # el componente
├── ProductCard.type.ts         # props (si no son triviales)
├── ProductCard.const.ts        # constantes/mappers locales (si hace falta)
├── ProductCard.helper.ts       # utilidades puras del componente (si hace falta)
└── index.ts                    # barrel: export * from './ProductCard.component'
```

Componentes simples pueden definir las props inline y omitir `.type.ts`. Los consumidores importan
desde la carpeta (`#/product/components/ProductCard`), nunca desde el archivo interno.

```tsx
// ✅ ProductCard.component.tsx
import type { ProductCardProps } from './ProductCard.type';

export function ProductCard({ product }: ProductCardProps) {
  return <article className="rounded-lg border p-4">{product.name}</article>;
}
```

**Reglas de props y responsabilidad:**
- Pasa **subconjuntos** de entidades con `Pick`, no la entidad entera:
  `product: Pick<Product, 'id' | 'name'>` en vez de `product: Product`. Reduce el acoplamiento y
  documenta qué usa el componente.
- **Named exports** siempre, nunca `export default`. Facilita el barrel y el refactor de nombres.
- Los componentes de UI son **presentacionales**: no llaman a `api/` ni usan hooks de TanStack
  Query. El data fetching lo orquesta el **page component** y baja los datos por props.
- Nunca estilos inline: solo clases Tailwind. Clases condicionales con un helper `cn()` (ver
  `references/conventions.md`).

---

## 2. Page components

Uno por ruta, en `modules/<feature>/pages/<Name>Page/`. Son `'use client'` porque orquestan.

```tsx
// ✅ modules/product/pages/ProductsPage/ProductsPage.component.tsx
'use client';
import { useState } from 'react';
import { useProductsQuery } from '#/product/queries/hooks/useProductsQuery';
import { ProductCard } from '#/product/components/ProductCard';

export function ProductsPage() {
  const [type, setType] = useState<string>();
  const { data, isLoading } = useProductsQuery({ skip: 0, limit: 20, type });

  if (isLoading) return <Skeleton />;
  return <div>{data?.results.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}
```

**Responsabilidades del page component:** orquestar queries, estado local de UI (filtros, modales,
paginación), componer componentes y navegar. La lógica compleja se extrae a custom hooks (§3).
Nunca metas UI reutilizable en un page: extráela a `components/`.

---

## 3. Custom hooks

Encapsulan lógica de UI o de negocio del módulo. Sufijo `.hook.ts`, un export por archivo.

**Hook sencillo → un solo archivo.** Si cabe entero y legible en un archivo, ahí se queda:

```typescript
// ✅ modules/product/hooks/useProductFilters.hook.ts
export function useProductFilters() {
  const [type, setType] = useState<ProductType>();
  const clear = useCallback(() => setType(undefined), []);
  return { type, setType, clear };       // agrupa: estado, luego acciones
}
```

**Hook con complejidad → carpeta propia**, igual que un componente. En cuanto aparecen tipos
exportados, constantes de configuración o utilidades puras, se separan en lugar de engordar el
archivo:

```
modules/product/hooks/useProductTable/
├── useProductTable.hook.ts     # el hook
├── useProductTable.type.ts     # tipos (si hacen falta)
├── useProductTable.const.ts    # constantes/mappers (si hacen falta)
├── useProductTable.helper.ts   # utilidades puras (si hacen falta)
└── index.ts                    # barrel
```

El criterio es el mismo que en componentes: **empieza plano y extrae cuando duela**, no al revés.
Una carpeta con un único archivo dentro es ceremonia sin beneficio.

**Reglas:** nunca llames hooks condicionalmente; memoiza los handlers devueltos con `useCallback`
(deps siempre explícitas); los hooks componen otros hooks en vez de duplicar lógica; para datos del
servidor un hook **usa los query hooks**, nunca hace fetch por su cuenta. Hooks usados por 2+ módulos
suben a `shared/hooks/`.

---

## 4. Formularios (react-hook-form + Zod)

Un componente de formulario reutilizable tiene 4 archivos, con el schema **separado** del componente:

```
components/ProductForm/
├── ProductForm.component.tsx
├── ProductForm.schema.ts       # el schema Zod (formSchema)
├── ProductForm.type.ts         # tipos derivados del schema + Props
└── index.ts
```

```typescript
// ✅ ProductForm.schema.ts — validación declarativa, mensajes desde constantes
import { z } from 'zod';
import { FORM_VALIDATION_MSG } from '#/shared/constants/form-messages';
import { ProductType } from '#/product/types';

export const formSchema = z.object({
  name: z.string().trim().nonempty(FORM_VALIDATION_MSG.required),
  type: z.enum(ProductType),               // enums: z.enum(Enum), no z.nativeEnum
  description: z.string().optional(),
});
```

```typescript
// ✅ ProductForm.type.ts — el tipo se DERIVA del schema (una sola fuente de verdad)
import { z } from 'zod';
import { formSchema } from './ProductForm.schema';

export type ProductFormData = z.infer<typeof formSchema>;

export interface ProductFormProps {
  formId?: string;
  mode?: 'creation' | 'update';
  defaultValues?: Partial<ProductFormData>;
  onSubmit?: (data: ProductFormData) => void;  // callback, NO llama a la mutación
}
```

```tsx
// ✅ ProductForm.component.tsx — primitivas Form de shadcn, resolver de Zod
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formSchema } from './ProductForm.schema';
import type { ProductFormData, ProductFormProps } from './ProductForm.type';

export function ProductForm({ formId, onSubmit, defaultValues }: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', ...defaultValues },  // inicializa TODOS los campos
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit((data) => onSubmit?.(data))}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
```

**Reglas clave y su porqué:**
- **El schema fuera del componente** y el tipo derivado con `z.infer`: un solo origen de verdad para
  validación y tipos; no divergen.
- **`FormField` con `render`**, nunca `register()` con componentes custom: da label, error y
  accesibilidad de forma consistente. `FormMessage` pinta el error solo.
- Siempre `defaultValues` con todos los campos: evita el warning uncontrolled→controlled.
- El formulario reutilizable **expone `onSubmit`** y **no llama a la mutación**: la mutación vive en
  el page/layout que lo renderiza. Así el mismo formulario sirve para crear y editar.
- Mensajes de validación desde una constante (`FORM_VALIDATION_MSG`), no strings sueltos.
