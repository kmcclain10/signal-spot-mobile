import {createFileRoute} from '@tanstack/react-router';
import {Landing} from '@/components/Landing';
import {publicHead,PUBLIC_DESCRIPTION,PUBLIC_SITE} from '@/lib/public-content';
import ogPreview from '@/assets/og-preview.mp4.asset.json';

const ogVideoUrl = `${PUBLIC_SITE}${ogPreview.url}`;
export const Route=createFileRoute('/')({
  staticData:{sitemap:true},
  head:()=>{
    const head=publicHead('Options & equity alerts',PUBLIC_DESCRIPTION,'/');
    return {...head,meta:[...head.meta,
      {property:'og:video',content:ogVideoUrl},
      {property:'og:video:secure_url',content:ogVideoUrl},
      {property:'og:video:type',content:'video/mp4'},
      {property:'og:video:width',content:'1200'},
      {property:'og:video:height',content:'630'},
    ]};
  },
  component:Landing,
});
