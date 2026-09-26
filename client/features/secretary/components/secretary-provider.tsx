"use client";
import {useClinic} from "@/features/clinic/components/clinic-provider";
export function useSecretary(){const {admin,executeAdmin}=useClinic();return {data:admin,execute:executeAdmin};}