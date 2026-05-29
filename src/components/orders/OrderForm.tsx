"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  itemName: z.string().min(1, "Item name is required").max(200),
  teamId: z.string().min(1, "Select a team"),
  quantity: z
    .string()
    .min(1, "Required")
    .regex(/^\d+$/, "Whole number")
    .refine((v) => Number(v) >= 1 && Number(v) <= 9999, "Between 1 and 9999"),
  vendorUrl: z
    .string()
    .max(500)
    .optional()
    .refine(
      (v) => !v || z.string().url().safeParse(v).success,
      "Enter a valid URL",
    ),
  unitPrice: z
    .string()
    .max(20)
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      "Enter a valid amount",
    ),
  partType: z.string().max(100).optional(),
  partNumber: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Team = { id: number; name: string };

export function OrderForm({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemName: "",
      teamId: "",
      quantity: "1",
      vendorUrl: "",
      unitPrice: "",
      partType: "",
      partNumber: "",
      description: "",
    },
  });

  const teamItems = Object.fromEntries(teams.map((t) => [String(t.id), t.name]));

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: values.itemName,
          teamId: Number(values.teamId),
          quantity: Number(values.quantity),
          vendorUrl: values.vendorUrl || undefined,
          unitPrice: values.unitPrice ? Number(values.unitPrice) : undefined,
          partType: values.partType || undefined,
          partNumber: values.partNumber || undefined,
          description: values.description || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to submit order");
      }
      toast.success("Order submitted for review");
      router.push("/orders");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="itemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. NEMA 17 stepper motor" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="teamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team</FormLabel>
                <Select
                  items={teamItems}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="vendorUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>Link to the product page (optional).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="partType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Motor" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="partNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Part number</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit price (USD)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Optional"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description / justification</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What it's for and any details the reviewer needs."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit order"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/orders")}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
