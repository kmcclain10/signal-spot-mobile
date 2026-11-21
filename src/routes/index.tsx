import {createFileRoute} from '@tanstack/react-router';
import {Landing} from '@/components/Landing';
import {publicHead,PUBLIC_DESCRIPTION} from '@/lib/public-content';
export const Route=createFileRoute('/')({staticData:{sitemap:true},head:()=>publicHead('Options & equity alerts',PUBLIC_DESCRIPTION,'/'),component:Landing});
