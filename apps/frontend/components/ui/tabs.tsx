"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => <TabsPrimitive.List className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1", className)} {...props} />;
export const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => <TabsPrimitive.Trigger className={cn("rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition data-[state=active]:bg-slate-950 data-[state=active]:text-white", className)} {...props} />;
export const TabsContent = ({ className, ...props }: TabsPrimitive.TabsContentProps) => <TabsPrimitive.Content className={cn("mt-5 outline-none", className)} {...props} />;
