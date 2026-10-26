import type {Metadata} from 'next';
import {Geist,Geist_Mono} from 'next/font/google';
import './globals.css';
const sans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const mono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
export const metadata:Metadata={title:'流转中控台 · Mac 自动化管理',description:'集中管理 Mac mini 自动化转发、磁盘清理、任务执行与操作审计。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body></html>}
