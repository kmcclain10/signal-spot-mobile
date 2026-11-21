import {createFileRoute} from '@tanstack/react-router';
import {Landing} from '@/routes/welcome';
import {publicHead,PUBLIC_DESCRIPTION} from '@/lib/public-content';
export const Route=createFileRoute('/')({staticData:{sitemap:true},head:()=>publicHead('The Signal Spot — Options & equity alerts',PUBLIC_DESCRIPTION,'/'),component:Landing});
