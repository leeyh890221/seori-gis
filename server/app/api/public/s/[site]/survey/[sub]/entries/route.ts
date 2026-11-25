// FieldMappy 공개용 기초조사 기록 API
// GET /api/public/s/{site}/survey/{sub}/entries
// GIS 분석 화면(public/gis/seori/index.html)이 페이지를 열 때마다 이 주소를 읽어 최신 기초조사를 반영합니다.
// 개인정보(연락처·사진 등)는 내보내지 않고, 분석에 필요한 필드만 배열로 돌려줍니다.
import { NextResponse } from 'next/server';
// ↓ FieldMappy 안에서 조사 기록을 조회하는 기존 함수로 바꿔 주세요.
//   (지금 로그인용 API  /api/s/{site}/survey/{sub}/entries?form_id=...  가 쓰는 함수와 같은 것)
import { listEntries } from '@/lib/survey/entries';

// 공개를 허용할 사이트·현장조사 메뉴·양식만 적습니다.
const PUBLIC_FEEDS: Record<string, { sub: string; formId: string }> = {
  soyang: { sub: '145', formId: 'c8c257ce-76c7-4aa3-9e76-7836e25b86aa' }, // 소양강댐 양지천 · 기초조사
};

const ADDR_PREFIX = '강원특별자치도 인제군 기린면 ';

export const revalidate = 300; // 5분 캐시 (원하면 0으로)

export async function GET(_req: Request, ctx: { params: { site: string; sub: string } }) {
  const { site, sub } = ctx.params;
  const feed = PUBLIC_FEEDS[site];
  if (!feed || feed.sub !== sub) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  const rows = await listEntries({ site, subId: sub, formId: feed.formId });
  const data = rows.map((e: any) => {
    const d = typeof e.data_json === 'string' ? JSON.parse(e.data_json) : (e.data_json || {});
    return [
      String(e.id).slice(0, 8),                 // 0 기록 id(앞 8자리)
      String(e.created_at).slice(0, 10),        // 1 조사일
      e.owner_name || '',                       // 2 조사자
      d.field_1 || '',                          // 3 제목 (예: "36,38번(논)")
      d.field_2 || '',                          // 4 구분 (경작지/시설물/하천/오염원 …)
      d.field_3 || '',                          // 5 메모 (예: "밭 작물", "토사 유출")
      d.lat != null ? Number(Number(d.lat).toFixed(6)) : null, // 6 위도
      d.lon != null ? Number(Number(d.lon).toFixed(6)) : null, // 7 경도
      String(d._address || '').replace(ADDR_PREFIX, ''),       // 8 주소 (예: "서리 1601-1")
    ];
  });
  return NextResponse.json(
    { ok: true, updated: new Date().toISOString(), count: data.length, data },
    { headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } },
  );
}
