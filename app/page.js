'use client';
import { useEffect, useMemo, useState } from 'react';

// --- small helpers (no imports needed) ---
function kcalFromMacros({protein=0,fat=0,carbs=0}){ return protein*4 + carbs*4 + fat*9; }
function macrosFromNutrients(n){
  const g=(k,f=0)=>{const v=Number(n?.[k]??n?.[k.toLowerCase()]??f);return Number.isFinite(v)?v:f};
  const protein=g('proteins_100g')||g('protein');
  const fat=g('fat_100g')||g('fat');
  const carbs=g('carbohydrates_100g')||g('carbohydrates');
  const energyKcal=g('energy-kcal_100g')||g('energy_kcal')||g('calories');
  return { protein:+(protein||0), fat:+(fat||0), carbs:+(carbs||0), energyKcal:+(energyKcal||0) };
}
function defaultGoals(w=75){
  const protein=+(1.6*w).toFixed(0), fat=+(0.8*w).toFixed(0), kcal=2000;
  const carbs=Math.max(0, Math.round((kcal - (protein*4 + fat*9))/4));
  return { protein, fat, carbs, energyKcal:kcal };
}
function suggestSwap(entry){
  const n=(entry?.name||'').toLowerCase();
  if(n.includes('crisps')||n.includes('chips')) return 'Try air-popped popcorn or baked crisps.';
  if(n.includes('cola')||n.includes('soda')) return 'Swap to diet/zero sugar soda.';
  if(n.includes('fried')) return 'Opt for grilled/roasted instead of fried.';
  return 'Consider a portion tweak or a higher-protein alternative.';
}

export default function Home() {
  const [q, setQ] = useState('chicken sandwich');
  const [source, setSource] = useState('OFF');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diary, setDiary] = useState([]);
  const [weight, setWeight] = useState(75);

  const goals = useMemo(() => defaultGoals(weight), [weight]);
  const totals = useMemo(() => diary.reduce((a, it) => ({
    protein: a.protein + it.protein,
    fat: a.fat + it.fat,
    carbs: a.carbs + it.carbs,
    energyKcal: a.energyKcal + (it.energyKcal || kcalFromMacros(it))
  }), { protein:0, fat:0, carbs:0, energyKcal:0 }), [diary]);

  useEffect(() => { const s = localStorage.getItem('diary'); if (s) setDiary(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem('diary', JSON.stringify(diary)); }, [diary]);

  async function searchFoods(e) {
    e?.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = source === 'OFF'
        ? `/api/off/search?q=${encodeURIComponent(q)}`
        : `/api/fdc/search?q=${encodeURIComponent(q)}`;
      const r = await fetch(endpoint);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Search failed');
      const normalized = (data.items || []).map(it => {
        if (source === 'OFF') {
          const m = macrosFromNutrients(it.nutriments||{});
          return { id: it.id, name: it.name || 'Unnamed product', brand: it.brand, source: it.source, ...m };
        } else {
          const m = it.nutrients || {};
          return { id: it.id, name: it.name, brand: it.brand, source: it.source,
            protein: m.protein||0, fat: m.fat||0, carbs: m.carbohydrates||0, energyKcal: m.energy_kcal||0 };
        }
      });
      setItems(normalized);
    } catch (err) { setError(err.message || 'Search failed'); }
    finally { setLoading(false); }
  }

  function addToDiary(it){
    setDiary(d => [...d, {
      name: it.name, source: it.source,
      protein: it.protein||0, fat: it.fat||0, carbs: it.carbs||0,
      energyKcal: it.energyKcal || kcalFromMacros(it)
    }]);
  }
  function clearDiary(){ setDiary([]); }

  useEffect(()=>{ searchFoods(); },[]);

  return (
    <div className="grid">
      <div className="col-8">
        <div className="card">
          <form onSubmit={searchFoods} style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search foods or meals (e.g., 'Tesco chicken wrap')" />
            <div className="nav" role="group" aria-label="Source" style={{margin:0}}>
              <a href="#" className="pill" onClick={(e)=>{e.preventDefault();setSource('OFF')}}>OFF</a>
              <a href="#" className="pill" onClick={(e)=>{e.preventDefault();setSource('FDC')}}>FDC</a>
            </div>
            <button className="btn" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          </form>
          {error && <p style={{color:'#ef4444',marginTop:8}}>{error}</p>}
        </div>

        <div style={{height:12}}/>
        <div className="card">
          <h3>Results</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Kcal</th><th/></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>{it.name} <span className="tag">{it.source}</span></td>
                  <td>{(it.protein||0).toFixed(1)} g</td>
                  <td>{(it.carbs||0).toFixed(1)} g</td>
                  <td>{(it.fat||0).toFixed(1)} g</td>
                  <td>{(it.energyKcal||kcalFromMacros(it)).toFixed(0)}</td>
                  <td><button className="btn secondary" onClick={()=>addToDiary(it)}>Add</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length===0 && <p className="small">No results yet. Try another query.</p>}
        </div>
      </div>

      <div className="col-4">
        <div className="card">
          <h3>Goals</h3>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label className="small">Weight (kg)</label>
            <input type="number" className="input" value={weight} onChange={e=>setWeight(parseInt(e.target.value||'75',10))} style={{maxWidth:120}}/>
          </div>
          <p className="small">Protein 1.6g/kg, fat 0.8g/kg, ~2000 kcal; carbs are the remainder.</p>
          <table className="table"><tbody>
            <tr><td>Protein</td><td>{goals.protein} g</td></tr>
            <tr><td>Carbs</td><td>{goals.carbs} g</td></tr>
            <tr><td>Fat</td><td>{goals.fat} g</td></tr>
            <tr><td>Energy</td><td>{goals.energyKcal} kcal</td></tr>
          </tbody></table>
        </div>

        <div style={{height:12}}/>
        <div className="card">
          <h3>Today’s Diary</h3>
          <table className="table">
            <thead><tr><th>Item</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Kcal</th></tr></thead>
            <tbody>
              {diary.map((d,i)=>(
                <tr key={i}>
                  <td title={suggestSwap(d)}>{d.name}</td>
                  <td>{(d.protein||0).toFixed(1)} g</td>
                  <td>{(d.carbs||0).toFixed(1)} g</td>
                  <td>{(d.fat||0).toFixed(1)} g</td>
                  <td>{(d.energyKcal||kcalFromMacros(d)).toFixed(0)}</td>
                </tr>
              ))}
              {diary.length>0 && (
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{totals.protein.toFixed(1)} g</strong></td>
                  <td><strong>{totals.carbs.toFixed(1)} g</strong></td>
                  <td><strong>{totals.fat.toFixed(1)} g</strong></td>
                  <td><strong>{totals.energyKcal.toFixed(0)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
          <button className="btn secondary" onClick={clearDiary}>Clear</button>
        </div>
      </div>
    </div>
  );
}
