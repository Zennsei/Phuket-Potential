import { useMemo, useState } from "react";
import WeightPanel from "../components/WeightPanel";
import { DEFAULT_WEIGHTS, FACTORS } from "../factors";
import { scoreTambons } from "../scoring";
import { scoreColor } from "../color";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { Weights } from "../types";

type Role = "planner" | "investor" | "resident";

const ROLES: { id: Role; th: string; en: string; goalTh: string; goalEn: string }[] = [
  { id: "planner", th: "เจ้าหน้าที่ผังเมือง", en: "City planner", goalTh: "กระจายความเจริญออกจากเมืองเก่าที่แออัด ไปยังพื้นที่ที่โครงสร้างพื้นฐานรองรับได้", goalEn: "Spread growth away from the crowded old town to areas whose infrastructure can support it" },
  { id: "investor", th: "นักลงทุน / เจ้าของกิจการ", en: "Investor / business owner", goalTh: "หาทำเลที่ลูกค้าเข้าถึงง่าย แต่ต้นทุนที่ดินยังไม่สูงเกินไป", goalEn: "Find a location customers can reach easily, before land becomes too expensive" },
  { id: "resident", th: "ประชาชนทั่วไป", en: "Resident", goalTh: "หาพื้นที่อยู่อาศัยที่ใกล้บริการพื้นฐาน เช่น โรงเรียน โรงพยาบาล และตลาด", goalEn: "Find a place to live close to schools, health care and markets" },
];

const STEPS = [
  { th: "บทบาท", en: "Role" },
  { th: "หลักฐาน", en: "Evidence" },
  { th: "หลักเกณฑ์", en: "Decision rule" },
  { th: "ตัดสินใจ", en: "Decide" },
  { th: "Stress Test", en: "Stress test" },
  { th: "สรุป", en: "Summary" },
];

interface Scenario {
  id: string;
  th: string;
  en: string;
  descTh: string;
  descEn: string;
  apply: (w: Weights) => Weights;
}

const SCENARIOS: Scenario[] = [
  {
    id: "no-road", th: "ถนนสายหลักถูกตัด", en: "Main road cut off",
    descTh: "น้ำท่วมหรือดินสไลด์ทำให้ใช้ข้อมูลการเข้าถึงถนนไม่ได้ ปัจจัยถนนถูกปิด",
    descEn: "A flood or landslide makes road access unreliable, so the road factor is switched off",
    apply: (w) => ({ ...w, road: { ...w.road, direction: 0 } }),
  },
  {
    id: "no-land", th: "ข้อมูลราคาที่ดินไม่ครบ", en: "Land price data missing",
    descTh: "ไม่มีข้อมูลราคาประเมิน ต้องตัดสินใจจากปัจจัยที่เหลือ",
    descEn: "No appraisal data is available, so the decision uses the remaining factors",
    apply: (w) => ({ ...w, land: { ...w.land, direction: 0 } }),
  },
  {
    id: "decentralise", th: "นโยบายลดความแออัด", en: "Decongestion policy",
    descTh: "จังหวัดไม่ส่งเสริมพื้นที่ที่อาคารหนาแน่นอยู่แล้ว ความหนาแน่นอาคารยิ่งน้อยยิ่งได้คะแนน",
    descEn: "The province stops promoting already dense areas: lower building density now scores higher",
    apply: (w) => ({ ...w, buildings: { weight: w.buildings.weight || 20, direction: -1 } }),
  },
];

export default function Mission({ data }: PageProps) {
  const { t, num } = useI18n();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => data.tambons.features.map((f) => f.properties), [data]);
  const scored = useMemo(() => scoreTambons(rows, weights), [rows, weights]);
  const chosen = scored.find((s) => s.props.id === choice);
  const stress = useMemo(
    () =>
      SCENARIOS.map((sc) => {
        const r = scoreTambons(rows, sc.apply(weights));
        return { sc, rank: r.find((s) => s.props.id === choice)?.rank ?? 0, top: r[0] };
      }),
    [rows, weights, choice],
  );
  const roleDef = ROLES.find((r) => r.id === role);
  const robust = stress.filter((s) => s.rank <= 5).length;

  const summary = chosen
    ? [
        `${t("ภารกิจ: เลือกพื้นที่เศรษฐกิจใหม่ จ.ภูเก็ต", "Mission: choose a new economic area in Phuket")}`,
        `${t("บทบาท", "Role")}: ${roleDef ? t(roleDef.th, roleDef.en) : "-"}`,
        `${t("หลักเกณฑ์", "Rule")}: ${FACTORS.filter((f) => weights[f.key].direction !== 0)
          .map((f) => `${t(f.th, f.en)} ${weights[f.key].weight}${weights[f.key].direction === -1 ? t(" (กลับด้าน)", " (reversed)") : ""}`)
          .join(", ")}`,
        `${t("ตำบลที่เลือก", "Chosen")}: ${t(chosen.props.tambon_th, chosen.props.tambon_en)} (${t("อันดับ", "rank")} ${chosen.rank}, ${num(chosen.score, 1)})`,
        `${t("เหตุผล", "Reason")}: ${reason || "-"}`,
        ...stress.map((s) => `Stress test – ${t(s.sc.th, s.sc.en)}: ${t("อันดับ", "rank")} ${s.rank}`),
      ].join("\n")
    : "";

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <div className="eyebrow">{t("ด้านการจัดการเมืองและเส้นทางระเบียงเศรษฐกิจ", "Urban management & economic corridors")}</div>
        <h1>{t("ภารกิจ: เลือกพื้นที่เศรษฐกิจใหม่ของภูเก็ต", "Mission: choose Phuket's next economic area")}</h1>
        <p className="lede">
          {t("ใช้ข้อมูลหลายชั้นตัดสินใจว่าตำบลไหนควรได้รับการส่งเสริมเป็นศูนย์กลางเศรษฐกิจแห่งใหม่ แล้วทดสอบว่าการตัดสินใจยังใช้ได้ไหมเมื่อสถานการณ์เปลี่ยน",
             "Use several data layers to decide which sub-district should be promoted as a new economic centre, then test whether the decision holds when conditions change.")}
        </p>
        <nav className="mission-nav" aria-label={t("ขั้นตอนภารกิจ", "Mission steps")}>
          {STEPS.map((s, i) => (
            <button key={s.en} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
              {i + 1}. {t(s.th, s.en)}
            </button>
          ))}
        </nav>
      </header>

      {step === 0 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{t("คุณเล่นเป็นใคร", "Who are you in this mission")}</h2>
          <div className="choice">
            {ROLES.map((r) => (
              <button key={r.id} aria-pressed={role === r.id} onClick={() => setRole(r.id)}>
                <b>{t(r.th, r.en)}</b>
                <div className="small muted">{t(r.goalTh, r.goalEn)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{t("ดูหลักฐานเชิงพื้นที่", "Look at the spatial evidence")}</h2>
          <p className="prose">{t("เปิดหน้าแผนที่แล้วเปิดชั้นข้อมูลทีละชั้น ตอบคำถามเหล่านี้ให้ได้ก่อนไปขั้นต่อไป", "Open the map and turn on one layer at a time. Answer these questions before moving on.")}</p>
          <div className="grid3">
            {[
              { th: "อาคารกระจุกตัวที่ไหน และตำบลไหนยังมีที่ว่างเยอะ", en: "Where are buildings concentrated, and which sub-districts still have open land?", l: "GISTDA" },
              { th: "ถนนสายหลักผ่านตำบลไหนบ้าง ตำบลไหนอยู่ไกลถนน", en: "Which sub-districts do the main roads pass through, and which are far from them?", l: "OpenStreetMap" },
              { th: "ราคาที่ดินแพงที่สุดอยู่ตรงไหน สอดคล้องกับความหนาแน่นอาคารไหม", en: "Where is land most expensive, and does it match building density?", l: t("กรมธนารักษ์", "Treasury") },
              { th: "ประชากรอยู่หนาแน่นที่ไหน มีโรงเรียนและโรงพยาบาลพอไหม", en: "Where do people live most densely, and are there enough schools and hospitals?", l: "Kontur, OSM" },
              { th: "เปลี่ยนแผนที่พื้นหลังเป็นภาพดาวเทียม ซูมไปที่ตำบลที่สนใจ ยังมีที่ดินว่างหรือมีการก่อสร้างใหม่ไหม", en: "Switch the base map to satellite imagery and zoom into a sub-district: is there open land or new construction?", l: "GISTDA Sphere" },
              { th: "คลิกจุดบนแผนที่แล้วถาม Sphere ว่ารอบจุดนั้นมีสถานที่อะไรบ้าง", en: "Click a point and ask Sphere which places are around it", l: "GISTDA Sphere" },
            ].map((q) => (
              <div className="card" key={q.en}>
                <span className="pill muted small">{q.l}</span>
                <p style={{ marginTop: 8 }}>{t(q.th, q.en)}</p>
              </div>
            ))}
          </div>
          <div><a className="btn" href={href("map")} target="_blank" rel="noopener">{t("เปิดแผนที่ในแท็บใหม่", "Open the map in a new tab")}</a></div>
        </section>
      )}

      {step === 2 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{t("ตั้งหลักเกณฑ์การตัดสินใจ", "Set your decision rule")}</h2>
          <p className="prose">
            {roleDef
              ? t(`เป้าหมายของ${roleDef.th}: ${roleDef.goalTh} ปัจจัยไหนสำคัญที่สุดกับเป้าหมายนี้`, `Goal as ${roleDef.en}: ${roleDef.goalEn}. Which factors matter most for it?`)
              : t("ให้น้ำหนักกับปัจจัยที่สำคัญกับเป้าหมายของคุณ", "Weight the factors that matter for your goal.")}
          </p>
          <div className="grid3" style={{ alignItems: "start" }}>
            <div className="card"><WeightPanel weights={weights} setWeights={setWeights} /></div>
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>{t("5 อันดับแรกตามหลักเกณฑ์นี้", "Top 5 under this rule")}</h3>
              <div className="rankbars">
                {scored.slice(0, 5).map((s) => (
                  <div className="rb" key={s.props.id}>
                    <span>{s.rank}. {t(s.props.tambon_th, s.props.tambon_en)}</span>
                    <span className="track"><i style={{ width: `${s.score}%`, background: scoreColor(s.score) }} /></span>
                    <span className="num">{num(s.score, 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{t("เลือกตำบลและให้เหตุผล", "Choose a sub-district and explain why")}</h2>
          <p className="prose">{t("ไม่จำเป็นต้องเลือกอันดับ 1 ถ้ามีเหตุผลจากหลักฐานที่ดีกว่า", "You do not have to pick number 1 if the evidence gives you a better reason.")}</p>
          <div className="choice">
            {scored.map((s) => (
              <button key={s.props.id} aria-pressed={choice === s.props.id} onClick={() => setChoice(s.props.id)}>
                <span className="mono small muted">#{s.rank}</span> <b>{t(s.props.tambon_th, s.props.tambon_en)}</b>
                <div className="small muted">{t("คะแนน", "score")} {num(s.score, 1)}</div>
              </button>
            ))}
          </div>
          <label htmlFor="reason"><b>{t("เหตุผล (อ้างอิงหลักฐานอย่างน้อย 2 ชั้นข้อมูล)", "Reason (cite at least 2 data layers)")}</b></label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </section>
      )}

      {step === 4 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>Stress Test</h2>
          {!chosen ? (
            <p>{t("เลือกตำบลในขั้นที่ 4 ก่อน", "Choose a sub-district in step 4 first.")}</p>
          ) : (
            <>
              <p className="prose">
                {t(`ถ้าสถานการณ์เปลี่ยน ต.${chosen.props.tambon_th} (ตอนนี้อันดับ ${chosen.rank}) ยังเป็นตัวเลือกที่ดีอยู่ไหม`,
                   `If conditions change, is ${chosen.props.tambon_en} (now rank ${chosen.rank}) still a good choice?`)}
              </p>
              <div className="grid3">
                {stress.map((s) => {
                  const delta = chosen.rank - s.rank;
                  return (
                    <div className="card" key={s.sc.id} style={{ display: "grid", gap: 8 }}>
                      <b>{t(s.sc.th, s.sc.en)}</b>
                      <span className="small muted">{t(s.sc.descTh, s.sc.descEn)}</span>
                      <div className="row" style={{ alignItems: "baseline" }}>
                        <span className="bigscore" style={{ fontSize: 30 }}>#{s.rank}</span>
                        <span className="small" style={{ color: delta > 0 ? "var(--ok)" : delta < 0 ? "var(--bad)" : "var(--muted)" }}>
                          {delta === 0 ? t("อันดับเท่าเดิม", "same rank") : delta > 0 ? t(`ขึ้น ${delta} อันดับ`, `up ${delta}`) : t(`ลง ${-delta} อันดับ`, `down ${-delta}`)}
                        </span>
                      </div>
                      <span className="small muted">{t("อันดับ 1 ในสถานการณ์นี้", "Number 1 here")}: {t(s.top.props.tambon_th, s.top.props.tambon_en)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="card">
                {robust === 3
                  ? t("ตัวเลือกนี้แข็งแรง ยังอยู่ใน 5 อันดับแรกทุกสถานการณ์", "A robust choice: it stays in the top 5 in every scenario.")
                  : robust === 0
                    ? t("ตัวเลือกนี้เปราะบาง หลุด 5 อันดับแรกทุกสถานการณ์ ลองทบทวนหลักเกณฑ์หรือเหตุผล", "A fragile choice: it drops out of the top 5 in every scenario. Revisit your rule or reasoning.")
                    : t(`ตัวเลือกนี้อยู่ใน 5 อันดับแรก ${robust} จาก 3 สถานการณ์ ควรระบุว่าขึ้นกับปัจจัยไหน`, `This choice stays in the top 5 in ${robust} of 3 scenarios. Note which factor it depends on.`)}
              </p>
            </>
          )}
        </section>
      )}

      {step === 5 && (
        <section style={{ display: "grid", gap: 14 }}>
          <h2>{t("สรุปภารกิจ", "Mission summary")}</h2>
          {chosen ? (
            <>
              <pre className="card mono small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{summary}</pre>
              <div className="row">
                <button
                  className="btn"
                  onClick={() =>
                    navigator.clipboard.writeText(summary).then(
                      () => setCopied(true),
                      () => setCopied(false),
                    )
                  }
                >
                  {copied ? t("คัดลอกแล้ว", "Copied") : t("คัดลอกสรุป", "Copy summary")}
                </button>
              </div>
              <div className="card prose">
                <b>{t("สิ่งที่ได้เรียนรู้", "What this mission teaches")}</b>
                <p style={{ marginTop: 6 }}>
                  {t("คำตอบว่า \"พื้นที่ไหนดีที่สุด\" ขึ้นกับหลักเกณฑ์และบทบาทของผู้ตัดสินใจ ข้อมูลหลายชั้นทำให้เหตุผลตรวจสอบได้ และ Stress Test ช่วยบอกว่าการตัดสินใจพึ่งพาข้อมูลชิ้นไหนมากเกินไป",
                     "Which area is \"best\" depends on the rule and on who is deciding. Several data layers make the reasoning checkable, and the stress test shows which data the decision leans on too heavily.")}
                </p>
              </div>
            </>
          ) : (
            <p>{t("ทำขั้นที่ 1–5 ให้ครบก่อน", "Complete steps 1–5 first.")}</p>
          )}
        </section>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("ย้อนกลับ", "Back")}</button>
        <button className="btn" disabled={step === STEPS.length - 1 || (step === 0 && !role) || (step === 3 && !choice)} onClick={() => setStep(step + 1)}>
          {t("ขั้นต่อไป", "Next")}
        </button>
      </div>
    </div>
  );
}
