---
name: tanstack-query-best-practices
description: 'Guía de mejores prácticas para TanStack Query (React Query). Aplica este skill SIEMPRE que el usuario esté trabajando con peticiones HTTP, llamadas a API (fetch, axios, ky, etc.), useQuery, useMutation, useQueryClient, useInfiniteQuery, gestión de estado del servidor, caché de datos remotos, invalidación de queries o refetching. Úsalo también cuando refactoricen hooks de datos, pregunten cómo estructurar la capa de red en React, o tengan errores con staleTime, gcTime, query keys duplicadas o componentes que llaman useQuery directamente. No esperes que mencionen TanStack Query — si están moviendo datos entre servidor y cliente en React, este skill aplica.'
---

# TanStack Query — Mejores Prácticas

Cuando trabajes con TanStack Query (o React Query), sigue estos principios para mantener el código limpio, predecible y eficiente. El objetivo es separar responsabilidades, evitar bugs de caché y hacer que la lógica de datos sea reutilizable.

---

## 1. Encapsula siempre en Custom Hooks

Nunca uses `useQuery` o `useMutation` directamente dentro de un componente de UI. Los componentes deben ser consumidores simples — no deben saber cómo se obtienen los datos.

**Por qué importa:** Si el componente conoce los detalles de la query (queryKey, queryFn, opciones), se vuelve frágil y difícil de reutilizar. Un Custom Hook centraliza esa lógica.

```ts
// ❌ Evitar — acoplamiento directo en el componente
const { data, isLoading } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});

// ✅ Correcto — el componente no sabe cómo se obtienen los datos
// src/modules/todos/hooks/useTodos.ts
export const useTodos = () => {
  return useQuery({
    queryKey: todoKeys.all(),
    queryFn: fetchTodos,
  });
};

// En el componente:
const { data, isLoading } = useTodos();
```

---

## 2. Usa el patrón Query Key Factory

Las query keys son el sistema nervioso de la caché. Si las escribes a mano como strings o arrays en cada archivo, tarde o temprano habrá un typo que cause un bug silencioso.

Crea un objeto centralizado por dominio que genere las keys de forma consistente:

```ts
// src/modules/todos/keys.ts
export const todoKeys = {
  all: () => ['todos'] as const,
  lists: () => [...todoKeys.all(), 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), { filters }] as const,
  details: () => [...todoKeys.all(), 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
};
```

**Beneficio clave:** Al invalidar caché después de una mutación, `todoKeys.lists()` invalida exactamente lo correcto — sin riesgo de typos:

```ts
queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
```

---

## 3. Separa la capa de red (API layer)

TanStack Query gestiona estado asíncrono, no sabe nada de HTTP. Mantén las funciones que hacen las llamadas a la API en archivos separados — no dentro de los hooks.

```ts
// src/modules/todos/api/fetchTodos.ts
export const fetchTodos = async (filters?: TodoFilters): Promise<Todo[]> => {
  const { data } = await apiClient.get('/todos', { params: filters });
  return data;
};

// src/modules/todos/hooks/useTodos.ts
import { fetchTodos } from '../api/fetchTodos';

export const useTodos = (filters?: TodoFilters) => {
  return useQuery({
    queryKey: todoKeys.list(filters),
    queryFn: () => fetchTodos(filters),
  });
};
```

Esto hace que las funciones de API sean testables de forma independiente y reutilizables fuera de React.

---

## 4. Configura el QueryClient con valores razonables

Los defaults de TanStack Query son muy agresivos para la mayoría de apps. `staleTime: 0` significa que los datos se consideran obsoletos de inmediato y se refetchean en cada mount. Configura el QueryClient a nivel global según las necesidades reales de tu app.

```ts
// src/lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — no refetch si los datos son recientes
      gcTime: 1000 * 60 * 30, // 30 min — mantén en caché aunque no haya suscriptores
      refetchOnWindowFocus: false, // Evita refetch al volver al tab (ajusta según tu caso)
      retry: 1, // Solo 1 reintento (por defecto son 3)
    },
  },
});
```

**Cuándo ajustar:** Apps con datos en tiempo real pueden necesitar `staleTime` más corto o `refetchInterval`. Apps con datos estáticos pueden ir mucho más altos. Calibra por dominio si hace falta.

---

## 5. Usa `select` para transformar y filtrar datos

Si la API devuelve más de lo que el componente necesita, usa la opción `select` para derivar solo lo relevante. Esto evita renders innecesarios — el componente solo se re-renderiza si el valor seleccionado cambia.

```ts
// El componente solo recibe los nombres, no el objeto User completo
export const useActiveUserNames = () => {
  return useQuery({
    queryKey: userKeys.all(),
    queryFn: fetchUsers,
    select: (data) => data.filter((user) => user.isActive).map((user) => user.name),
  });
};
```

También es útil para normalizar formatos de fecha, mapear IDs, o aplanar estructuras anidadas.

---

## 6. Estructura de carpetas por dominio

Organiza el código por **dominio** (feature/módulo), no por tipo de archivo. Esto escala bien y mantiene todo lo relacionado con "todos" junto.

```
src/
└── modules/
    └── todos/
        ├── api/           # fetchTodos.ts, createTodo.ts, etc.
        ├── hooks/         # useTodos.ts, useCreateTodo.ts, etc.
        ├── components/    # TodoList.tsx, TodoItem.tsx, etc.
        └── keys.ts        # todoKeys (Query Key Factory)
```

Evita carpetas globales como `src/hooks/` con cientos de archivos mezclados. Cada módulo es autónomo.

---

## 7. Invalidación de caché en mutaciones

Después de crear, actualizar o eliminar datos, invalida las queries afectadas para que la UI refleje el estado real del servidor. O usa `optimistic updates` si necesitas respuesta inmediata.

```ts
// src/modules/todos/hooks/useCreateTodo.ts
export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodoApi,
    onSuccess: () => {
      // Invalida todas las listas de todos — el refetch ocurre automáticamente
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
    onError: (error) => {
      // Maneja el error de forma centralizada (toast, log, etc.)
      console.error('Error creating todo:', error);
    },
  });
};
```

Para updates optimistas, usa `onMutate` para actualizar la caché local antes de que el servidor responda, y `onError` para revertir si falla.

---

## Checklist rápido al revisar código con TanStack Query

- [ ] ¿Hay `useQuery` o `useMutation` directamente en un componente? → Mover a Custom Hook
- [ ] ¿Las query keys están escritas a mano como strings/arrays? → Crear Key Factory
- [ ] ¿Las llamadas HTTP están dentro del hook? → Mover a capa `api/`
- [ ] ¿El QueryClient tiene `staleTime` configurado? → Configurar en `queryClient.ts`
- [ ] ¿Las mutaciones invalidan la caché? → Agregar `invalidateQueries` en `onSuccess`
- [ ] ¿El componente recibe más datos de los que usa? → Considerar `select`
- [ ] ¿Todo está en `src/hooks/`? → Reorganizar por módulos/dominios
