---
title: Forms & Validation
description: react-hook-form, zod, and @hookform/resolvers - how form state and validation are wired together.
---

## The three libraries and what each does

- **[react-hook-form](https://react-hook-form.com/)** manages form state (values, touched/dirty fields, submit status) without re-rendering the whole form on every keystroke.
- **[Zod](https://zod.dev/)** describes the _shape_ your data must have and validates it - `z.string().min(1)`, `z.enum([...])`, etc. - and can derive a TypeScript type from that shape automatically (`z.infer<typeof schema>`), so your types and your runtime validation can never drift apart.
- **[`@hookform/resolvers`](https://github.com/react-hook-form/resolvers)** is the small adapter package that lets react-hook-form use a Zod schema as its validator, via `zodResolver(schema)`.

None of these are Next.js-specific - this is a general pattern for any React app that has non-trivial forms.

## The pattern used throughout this codebase

Every form-heavy component (`OrderForm`, `LoginForm`, `SettingsForm`, `JoinRequestForm`, `WhitelistRequestForm`, `VaultEntryDialog`) follows the same shape. Using `src/components/orders/OrderForm.tsx` as the concrete example:

**1. Define a Zod schema at the top of the file**, including cross-field rules via `.superRefine()`:

```ts
const formSchema = z
    .object({
        fundType: z.enum(["STF", "Gift"], { message: "Select a fund type" }),
        stfBucketId: z.string().optional(),
        vendor: z.string().min(1, "Vendor is required").max(200),
        link: z.string().url("Enter a valid URL").max(500),
        quantity: z
            .string()
            .min(1, "Required")
            .regex(/^\d+$/, "Whole number")
            .refine((v) => Number(v) >= 1 && Number(v) <= 9999, "Between 1 and 9999"),
        // ...
    })
    .superRefine((data, ctx) => {
        if (data.fundType === "STF" && !data.stfBucketId) {
            ctx.addIssue({
                code: "custom",
                message: "Select an STF bucket",
                path: ["stfBucketId"],
            });
        }
    });

type FormValues = z.infer<typeof formSchema>;
```

`.superRefine()` is what handles validation that depends on _more than one field at once_ - here, "an STF bucket is required, but only if fundType is STF." A field-level `z.string().min(1)` can't express that; `superRefine` can add an issue to any field's `path` based on the whole object.

**2. Wire the schema into `useForm`:**

```ts
const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fundType: undefined, vendor: "", quantity: "1" /* ... */ },
});
```

**3. Render fields through shadcn's `Form` primitives** (`src/components/ui/form.tsx`), which connect each `FormField` to react-hook-form's state and automatically render Zod's error message via `FormMessage`:

```tsx
<FormField
    control={form.control}
    name="vendor"
    render={({ field }) => (
        <FormItem>
            <FormLabel>Vendor</FormLabel>
            <FormControl>
                <Input {...field} />
            </FormControl>
            <FormMessage />
        </FormItem>
    )}
/>
```

**4. On submit, call an API route directly** (not a Next.js Server Action) and report the result via a `sonner` toast:

```ts
async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
        const res = await fetch("/api/orders", { method: "POST", body: JSON.stringify(values) });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Order submitted");
        router.push("/orders");
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
        setSubmitting(false);
    }
}
```

## Why string fields for numbers?

Notice `quantity` and `unitCost` are `z.string()` with a `.regex()`/`.refine()` check, not `z.number()`. This is deliberate: HTML `<input>` values are always strings, and coercing on every keystroke fights the input's cursor position and empty-string state. The string is validated/parsed at submit time (and converted back to cents/integers before hitting the API) rather than during typing.

## Where else this pattern shows up

If you're adding a new form, don't design a new pattern - copy the shape from the closest existing example: `src/components/auth/LoginForm.tsx` (simple, no cross-field validation), or `src/components/orders/OrderForm.tsx` (cross-field validation via `superRefine`, edit-vs-create mode via an optional `initialOrder` prop).
