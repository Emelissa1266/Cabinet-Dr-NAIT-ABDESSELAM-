"use client";
import Link from "next/link";
import {useClinic} from "@/features/clinic/components/clinic-provider";
import {careFinancialSummary} from "@/features/clinic/services/care-finance";
import {formatAmount} from "@/lib/clinical-format";
import type {NursingProgram} from "../types";
import styles from "./nurse.module.css";
export function CareFinancialSummary({program}:{program:NursingProgram}){const {admin}=useClinic();const amount=careFinancialSummary(admin,program);return <section className={styles.inset}><h3>Facturation du soin</h3><p>{program.plannedSessions} séances × {formatAmount(program.pricePerSession??0)}</p><dl><dt>Total</dt><dd>{formatAmount(amount.total)}</dd><dt>Déjà payé</dt><dd>{formatAmount(amount.paid)}</dd><dt>Reste à payer</dt><dd>{formatAmount(amount.remaining)}</dd></dl><strong>{amount.status}</strong><p>Les règlements sont enregistrés par le secrétariat.</p><Link href="/nurse/billing">Voir la facturation des soins</Link></section>;}
