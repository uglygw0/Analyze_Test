import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, FileSpreadsheet, Activity, BarChart2, 
  TrendingUp, Layers, Network, PieChart, Database, 
  Settings, CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Scatter, Line, Bar } from 'react-chartjs-2';
import { SimpleLinearRegression } from 'ml-regression-simple-linear';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import { kmeans } from 'ml-kmeans';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export default function App() {
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisType, setAnalysisType] = useState('basic');

  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true, dynamicTyping: true,
        complete: (res) => {
          setData(res.data);
          if (res.data.length > 0) setColumns(Object.keys(res.data[0]));
        }
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json(ws, { defval: "" });
        
        // Convert string numbers to actual numbers
        const typedData = parsed.map(row => {
          const newRow = {};
          Object.keys(row).forEach(k => {
            const val = row[k];
            newRow[k] = !isNaN(Number(val)) && val !== "" ? Number(val) : val;
          });
          return newRow;
        });

        setData(typedData);
        if (typedData.length > 0) setColumns(Object.keys(typedData[0]));
      };
      reader.readAsBinaryString(file);
    } else {
      alert("지원하지 않는 파일 형식입니다. CSV 또는 엑셀(.xlsx, .xls) 파일을 업로드하세요.");
    }
  };

  const numericColumns = useMemo(() => {
    if (!data || !columns.length) return [];
    return columns.filter(col => {
      const isNum = data.some(row => typeof row[col] === 'number');
      return isNum;
    });
  }, [data, columns]);

  const renderWorkspace = () => {
    if (!data) {
      return (
        <div className="empty-state">
          <Database size={64} className="empty-icon" />
          <h3>데이터가 없습니다</h3>
          <p>좌측 사이드바에서 파일을 업로드하여 분석을 시작하세요.</p>
        </div>
      );
    }

    switch(analysisType) {
      case 'regression': return <RegressionAnalysis data={data} numCols={numericColumns} />;
      case 'multiple-regression': return <MultipleRegressionAnalysis data={data} numCols={numericColumns} />;
      case 'logistic': return <LogisticAnalysis data={data} numCols={numericColumns} />;
      case 'timeseries': return <TimeSeriesAnalysis data={data} numCols={numericColumns} />;
      case 'dendrogram': return <DendrogramAnalysis data={data} numCols={numericColumns} />;
      case 'kmeans': return <KMeansAnalysis data={data} numCols={numericColumns} />;
      case 'decision-tree': return <DecisionTreeAnalysis data={data} numCols={numericColumns} />;
      case 'random-forest': return <RandomForestAnalysis data={data} numCols={numericColumns} />;
      default: return <BasicStats data={data} columns={columns} numCols={numericColumns} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Activity size={24} /></div>
          <h1>데이터 분석기</h1>
        </div>

        <div 
          className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} />
          <UploadCloud className="upload-icon" size={32} />
          <div className="upload-text">
            <h3>파일 업로드</h3>
            <p>CSV, Excel 파일 드롭</p>
          </div>
        </div>

        {data && (
          <div className="file-info-card fade-in">
            <div className="file-name-row">
              <FileSpreadsheet size={20} color="var(--success-color)" />
              <span className="file-name">{fileName}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              총 {data.length}행 | {columns.length}열
            </div>
            <div className="col-badges">
              {numericColumns.slice(0, 10).map(c => <span key={c} className="col-badge">{c}</span>)}
              {numericColumns.length > 10 && <span className="col-badge">+{numericColumns.length - 10}</span>}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-nav">
          <div className="nav-group">
            <span className="nav-label">분석 선택</span>
            <select className="nav-select" value={analysisType} onChange={e => setAnalysisType(e.target.value)}>
              <option value="basic">기본 데이터 요약</option>
              <optgroup label="예측 모형 (Predictive)">
                <option value="regression">회귀분석</option>
                <option value="multiple-regression">다중 회귀분석</option>
                <option value="logistic">로지스틱 회귀분석</option>
                <option value="timeseries">시계열 분석</option>
              </optgroup>
              <optgroup label="분류 모형 (Classification)">
                <option value="dendrogram">덴드로그램</option>
                <option value="kmeans">K-Means 군집분석</option>
                <option value="decision-tree">의사결정나무</option>
                <option value="random-forest">랜덤 포레스트</option>
              </optgroup>
            </select>
          </div>
        </header>

        <div className="analysis-workspace">
          {renderWorkspace()}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// Analysis Components
// ==========================================

function BasicStats({ data, columns, numCols }) {
  // Data for missing values
  const missingData = columns.map(col => {
    return data.filter(row => row[col] === null || row[col] === undefined || row[col] === '').length;
  });

  const catColsCount = columns.length - numCols.length;
  
  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>기본 데이터 요약</h2>
        <p>업로드된 데이터의 개요를 확인하세요.</p>
      </div>
      <div className="results-grid">
        <div className="result-card">
          <div className="card-header">
            <h3><PieChart size={20} /> 변수 유형 분포</h3>
          </div>
          <div className="chart-container" style={{ height: '250px' }}>
            <Bar 
              options={{ maintainAspectRatio: false, indexAxis: 'y' }}
              data={{
                labels: ['수치형 변수', '범주/문자형 변수'],
                datasets: [{
                  label: '변수 개수',
                  data: [numCols.length, catColsCount],
                  backgroundColor: ['#6366f1', '#ec4899']
                }]
              }}
            />
          </div>
        </div>
        
        <div className="result-card">
          <div className="card-header">
            <h3><BarChart2 size={20} /> 변수별 결측치 (Missing Values)</h3>
          </div>
          <div className="chart-container" style={{ height: '250px' }}>
            <Bar 
              options={{ maintainAspectRatio: false }}
              data={{
                labels: columns,
                datasets: [{
                  label: '결측치 개수',
                  data: missingData,
                  backgroundColor: '#f59e0b'
                }]
              }}
            />
          </div>
        </div>

        <div className="result-card full-width">
          <div className="card-header">
            <h3><Database size={20} /> 데이터 미리보기 (상위 5행)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {Object.keys(data[0] || {}).map(k => <th key={k} style={{ padding: '12px', textAlign: 'left' }}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {Object.values(row).map((val, j) => <td key={j} style={{ padding: '12px' }}>{val}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegressionAnalysis({ data, numCols }) {
  const [xVar, setXVar] = useState(numCols[0] || '');
  const [yVar, setYVar] = useState(numCols[1] || '');
  const [model, setModel] = useState(null);
  
  const runAnalysis = () => {
    if (!xVar || !yVar) return;
    const x = []; const y = [];
    data.forEach(row => {
      if (typeof row[xVar] === 'number' && typeof row[yVar] === 'number') {
        x.push(row[xVar]); y.push(row[yVar]);
      }
    });
    if (x.length > 0) {
      const regression = new SimpleLinearRegression(x, y);
      setModel({ reg: regression, x, y, score: regression.score(x, y) });
    }
  };

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>회귀분석 (Simple Linear Regression)</h2>
        <p>두 연속형 변수 간의 선형 관계를 분석합니다.</p>
      </div>
      
      <div className="control-panel">
        <div className="input-group">
          <label>독립변수 (X축)</label>
          <select value={xVar} onChange={e => setXVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>종속변수 (Y축)</label>
          <select value={yVar} onChange={e => setYVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={runAnalysis}>
          <TrendingUp size={18} /> 분석 실행
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          <div className="result-card full-width">
            <div className="card-header">
              <h3><BarChart2 size={20} /> 회귀선 및 산점도</h3>
            </div>
            <div className="chart-container" style={{ height: '350px' }}>
              <Scatter 
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top' } },
                  scales: { x: { title: { display: true, text: xVar } }, y: { title: { display: true, text: yVar } } }
                }}
                data={{
                  datasets: [
                    {
                      type: 'line',
                      label: `회귀선 (Y = ${model.reg.slope.toFixed(4)}X + ${model.reg.intercept.toFixed(4)})`,
                      data: [
                        { x: Math.min(...model.x), y: model.reg.predict(Math.min(...model.x)) },
                        { x: Math.max(...model.x), y: model.reg.predict(Math.max(...model.x)) }
                      ],
                      borderColor: '#ec4899',
                      borderWidth: 2,
                      pointRadius: 0
                    },
                    {
                      type: 'scatter',
                      label: '관측치',
                      data: model.x.map((xVal, i) => ({ x: xVal, y: model.y[i] })),
                      backgroundColor: 'rgba(99, 102, 241, 0.6)'
                    }
                  ]
                }}
              />
            </div>
            <div className="metrics-grid">
              <div className="metric-box">
                <div className="metric-label">R² (설명력)</div>
                <div className="metric-value">{(model.score.r2).toFixed(4)}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">기울기 (Slope)</div>
                <div className="metric-value">{model.reg.slope.toFixed(4)}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">절편 (Intercept)</div>
                <div className="metric-value">{model.reg.intercept.toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="result-card full-width">
            <div className="card-header">
              <h3><AlertCircle size={20} /> 잔차도 (Residual Plot)</h3>
            </div>
            <div className="chart-container" style={{ height: '250px' }}>
              <Scatter 
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { title: { display: true, text: '예측값 (Predicted)' } }, y: { title: { display: true, text: '잔차 (Residual)' } } }
                }}
                data={{
                  datasets: [
                    {
                      type: 'line',
                      label: '0 기준선',
                      data: [
                        { x: Math.min(...model.x.map(v => model.reg.predict(v))), y: 0 },
                        { x: Math.max(...model.x.map(v => model.reg.predict(v))), y: 0 }
                      ],
                      borderColor: '#10b981',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      pointRadius: 0
                    },
                    {
                      type: 'scatter',
                      label: '잔차',
                      data: model.x.map((xVal, i) => ({ 
                        x: model.reg.predict(xVal), 
                        y: model.y[i] - model.reg.predict(xVal) 
                      })),
                      backgroundColor: 'rgba(245, 158, 11, 0.6)'
                    }
                  ]
                }}
              />
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>* 잔차가 0 기준선 주변에 무작위로 흩어져 있어야 회귀 모델이 적합하다고 판단합니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MultipleRegressionAnalysis({ data, numCols }) {
  const [yVar, setYVar] = useState(numCols[0] || '');
  const [xVars, setXVars] = useState([]);
  const [model, setModel] = useState(null);

  const toggleXVar = (col) => {
    setXVars(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const runAnalysis = () => {
    if (!yVar || xVars.length === 0) return;
    const x = []; const y = [];
    data.forEach(row => {
      let valid = typeof row[yVar] === 'number';
      xVars.forEach(col => { if (typeof row[col] !== 'number') valid = false; });
      if (valid) {
        y.push([row[yVar]]);
        x.push(xVars.map(col => row[col]));
      }
    });
    
    if (x.length > 0) {
      try {
        const regression = new MultivariateLinearRegression(x, y);
        
        // Calculate Actual vs Predicted & R2
        const actualVsPredicted = [];
        let ssTotal = 0;
        let ssRes = 0;
        const yMean = y.reduce((a, b) => a + b[0], 0) / y.length;
        let minY = Infinity, maxY = -Infinity;

        x.forEach((xRow, i) => {
          const actualY = y[i][0];
          const predictedY = regression.predict(xRow)[0];
          actualVsPredicted.push({ x: actualY, y: predictedY });
          
          ssTotal += Math.pow(actualY - yMean, 2);
          ssRes += Math.pow(actualY - predictedY, 2);
          
          if (actualY < minY) minY = actualY;
          if (actualY > maxY) maxY = actualY;
        });

        const r2 = ssTotal === 0 ? 0 : 1 - (ssRes / ssTotal);

        // Calculate Variable Impact (Standardized Coefficients proxy = Coef * StdDev)
        const impacts = [];
        xVars.forEach((col, idx) => {
          const vals = x.map(r => r[idx]);
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
          const stdDev = Math.sqrt(variance);
          const coef = regression.weights[idx + 1][0]; // weights[0] is intercept
          impacts.push({ col, impact: Math.abs(coef * stdDev), rawCoef: coef });
        });

        // Sort by impact
        impacts.sort((a, b) => b.impact - a.impact);

        setModel({ 
          weights: regression.weights, 
          xVars, 
          actualVsPredicted,
          r2,
          impacts,
          minY,
          maxY
        });
      } catch (e) {
        alert("다중 회귀분석 중 오류가 발생했습니다. 선형 대수 계산이 불가능한 데이터일 수 있습니다.");
      }
    }
  };

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>다중 회귀분석 (Multiple Linear Regression)</h2>
        <p>여러 개의 독립변수들이 하나의 종속변수에 미치는 영향을 분석합니다.</p>
      </div>

      <div className="control-panel">
        <div className="input-group">
          <label>종속변수 (Y)</label>
          <select value={yVar} onChange={e => setYVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ flex: 2 }}>
          <label>독립변수 (X들) - 여러 개 선택 가능</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
            {numCols.filter(c => c !== yVar).map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: xVars.includes(c) ? '#eff6ff' : 'transparent', padding: '4px 8px', borderRadius: '4px' }}>
                <input type="checkbox" checked={xVars.includes(c)} onChange={() => toggleXVar(c)} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{c}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={runAnalysis} disabled={xVars.length === 0}>
          <Layers size={18} /> 분석 실행
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          <div className="result-card">
            <div className="card-header">
              <h3><TrendingUp size={20} /> 실제값 vs 예측값 (모델 적합도)</h3>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              <Scatter 
                options={{ 
                  maintainAspectRatio: false,
                  scales: { x: { title: { display: true, text: '실제값 (Actual)' } }, y: { title: { display: true, text: '예측값 (Predicted)' } } }
                }}
                data={{
                  datasets: [
                    {
                      type: 'line',
                      label: '완전 일치 선 (y=x)',
                      data: [{ x: model.minY, y: model.minY }, { x: model.maxY, y: model.maxY }],
                      borderColor: '#10b981',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      pointRadius: 0
                    },
                    {
                      type: 'scatter',
                      label: '데이터 포인트',
                      data: model.actualVsPredicted,
                      backgroundColor: 'rgba(99, 102, 241, 0.6)'
                    }
                  ]
                }}
              />
            </div>
            <div className="metrics-grid">
              <div className="metric-box">
                <div className="metric-label">설명력 (R²)</div>
                <div className="metric-value">{model.r2.toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="result-card">
            <div className="card-header">
              <h3><BarChart2 size={20} /> 변수별 상대적 영향도 (Feature Impact)</h3>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              <Bar 
                options={{ maintainAspectRatio: false, indexAxis: 'y' }}
                data={{
                  labels: model.impacts.map(i => i.col),
                  datasets: [{
                    label: '상대적 영향도',
                    data: model.impacts.map(i => i.impact),
                    backgroundColor: model.impacts.map(i => i.rawCoef >= 0 ? 'rgba(99, 102, 241, 0.7)' : 'rgba(236, 72, 153, 0.7)'),
                  }]
                }}
              />
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              * 영향도는 표준화된 계수(회귀계수 × 변수의 표준편차)의 절댓값을 기준으로 정렬되며, 
              <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>파란색은 양(+)의 영향</span>, 
              <span style={{ color: '#db2777', fontWeight: 'bold' }}>분홍색은 음(-)의 영향</span>을 의미합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LogisticAnalysis({ data, numCols }) {
  // Mock Logistic Regression implementation
  const [xVar, setXVar] = useState(numCols[0] || '');
  const [model, setModel] = useState(null);

  const runAnalysis = () => {
    // Generate S-curve mock data based on xVar range
    const xVals = data.map(d => Number(d[xVar])).filter(v => !isNaN(v));
    const min = Math.min(...xVals);
    const max = Math.max(...xVals);
    
    setModel({ min, max, var: xVar });
  };

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>로지스틱 회귀분석 (Logistic Regression)</h2>
        <p>이항 분류를 위한 확률을 예측합니다. (시각화 데모)</p>
      </div>
      
      <div className="control-panel">
        <div className="input-group">
          <label>독립변수 (X축)</label>
          <select value={xVar} onChange={e => setXVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={runAnalysis}>
          <Activity size={18} /> 분석 실행
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          <div className="result-card full-width">
            <div className="card-header">
              <h3><Activity size={20} /> 예측 확률 곡선 (Sigmoid)</h3>
            </div>
            <div className="chart-container">
              <Line 
                options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 1 } } }}
                data={{
                  labels: Array.from({length: 20}, (_, i) => (model.min + (model.max - model.min) * (i / 19)).toFixed(2)),
                  datasets: [{
                    label: '성공 확률 (P)',
                    data: Array.from({length: 20}, (_, i) => {
                      const x = -5 + (10 * (i / 19)); // scaled to sigmoid friendly range
                      return 1 / (1 + Math.exp(-x));
                    }),
                    borderColor: '#6366f1',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.1)'
                  }]
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeSeriesAnalysis({ data, numCols }) {
  const [timeVar, setTimeVar] = useState(numCols[0] || '');
  const [model, setModel] = useState(null);

  const runAnalysis = () => {
    const vals = data.map(d => Number(d[timeVar])).filter(v => !isNaN(v)).slice(0, 100); // limit for clarity
    setModel({ vals, var: timeVar });
  };

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>시계열 분석 (Time Series Analysis)</h2>
        <p>시간의 흐름에 따른 데이터의 추세와 패턴을 확인합니다.</p>
      </div>
      
      <div className="control-panel">
        <div className="input-group">
          <label>분석할 수치형 변수</label>
          <select value={timeVar} onChange={e => setTimeVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={runAnalysis}>
          <TrendingUp size={18} /> 추세 그리기
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          <div className="result-card full-width">
            <div className="card-header">
              <h3><TrendingUp size={20} /> 시계열 추세선</h3>
            </div>
            <div className="chart-container">
              <Line 
                options={{ maintainAspectRatio: false, elements: { point: { radius: 2 } } }}
                data={{
                  labels: model.vals.map((_, i) => `t+${i}`),
                  datasets: [{
                    label: model.var,
                    data: model.vals,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.1
                  },
                  {
                    label: '7-이동평균 (Moving Average)',
                    data: model.vals.map((v, i, arr) => {
                      if (i < 6) return null;
                      let sum = 0;
                      for (let j = 0; j < 7; j++) sum += arr[i - j];
                      return sum / 7;
                    }),
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.4
                  }]
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DendrogramAnalysis() {
  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>덴드로그램 (Hierarchical Clustering)</h2>
        <p>계층적 군집분석을 통한 데이터들의 거리를 나무 형태로 표현합니다.</p>
      </div>
      <div className="results-grid">
        <div className="result-card full-width" style={{ alignItems: 'center' }}>
          <div className="mock-tree">
            <div className="tree-node">Cluster All</div>
            <div className="tree-branch">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="tree-node">Group A</div>
                <div className="tree-branch">
                  <div className="tree-node" style={{ background: '#fef2f2', borderColor: '#ef4444' }}>A1</div>
                  <div className="tree-node" style={{ background: '#fef2f2', borderColor: '#ef4444' }}>A2</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="tree-node">Group B</div>
                <div className="tree-branch">
                  <div className="tree-node" style={{ background: '#eff6ff', borderColor: '#3b82f6' }}>B1</div>
                  <div className="tree-node" style={{ background: '#eff6ff', borderColor: '#3b82f6' }}>B2</div>
                </div>
              </div>
            </div>
          </div>
          <p style={{ marginTop: '20px', color: 'var(--text-muted)' }}>* 이는 데이터 구조를 나타내는 시각적 데모입니다.</p>
        </div>
      </div>
    </div>
  );
}

function KMeansAnalysis({ data, numCols }) {
  const [xVar, setXVar] = useState(numCols[0] || '');
  const [yVar, setYVar] = useState(numCols[1] || '');
  const [kValue, setKValue] = useState(3);
  const [model, setModel] = useState(null);

  const runAnalysis = () => {
    if (!xVar || !yVar) return;
    const points = [];
    data.forEach(row => {
      const x = Number(row[xVar]); const y = Number(row[yVar]);
      if (!isNaN(x) && !isNaN(y)) points.push([x, y]);
    });

    if (points.length > kValue) {
      const ans = kmeans(points, kValue);
      const clusterCounts = Array(kValue).fill(0);
      ans.clusters.forEach(c => clusterCounts[c]++);
      setModel({ points, clusters: ans.clusters, centroids: ans.centroids, k: kValue, clusterCounts });
    }
  };

  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>K-Means 군집분석</h2>
        <p>데이터를 설정한 K개의 군집으로 그룹화합니다.</p>
      </div>

      <div className="control-panel">
        <div className="input-group">
          <label>변수 X</label>
          <select value={xVar} onChange={e => setXVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>변수 Y</label>
          <select value={yVar} onChange={e => setYVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>군집 수 (K)</label>
          <input type="number" min="2" max="5" value={kValue} onChange={e => setKValue(Number(e.target.value))} />
        </div>
        <button className="btn-primary" onClick={runAnalysis}>
          <PieChart size={18} /> 군집화 실행
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          <div className="result-card full-width">
            <div className="card-header">
              <h3><PieChart size={20} /> K-Means 결과 산점도</h3>
            </div>
            <div className="chart-container">
              <Scatter 
                options={{ maintainAspectRatio: false }}
                data={{
                  datasets: Array.from({length: model.k}, (_, i) => ({
                    label: `Cluster ${i + 1}`,
                    data: model.points.filter((_, idx) => model.clusters[idx] === i).map(p => ({ x: p[0], y: p[1] })),
                    backgroundColor: colors[i % colors.length]
                  }))
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionTreeAnalysis() {
  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>의사결정나무 (Decision Tree)</h2>
        <p>분류 규칙을 나무 형태로 학습하여 예측합니다.</p>
      </div>
      <div className="results-grid">
        <div className="result-card full-width" style={{ alignItems: 'center' }}>
          <div className="mock-tree">
            <div className="tree-node">소득 &gt; 5,000만?</div>
            <div className="tree-branch" style={{ gap: '80px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>Yes</span>
                <div className="tree-node" style={{ marginTop: '10px' }}>승인 (Approve)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold' }}>No</span>
                <div className="tree-node" style={{ marginTop: '10px' }}>신용점수 &gt; 700?</div>
                <div className="tree-branch" style={{ gap: '20px' }}>
                  <div className="tree-node" style={{ background: '#d1fae5' }}>승인</div>
                  <div className="tree-node" style={{ background: '#fee2e2' }}>거절</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="result-card full-width">
          <div className="card-header">
            <h3><BarChart2 size={20} /> 변수 중요도 (Feature Importance - Mock)</h3>
          </div>
          <div className="chart-container" style={{ height: '250px' }}>
            <Bar 
              options={{ maintainAspectRatio: false }}
              data={{
                labels: ['소득', '신용점수', '연령', '직업군'],
                datasets: [{
                  label: '중요도',
                  data: [0.45, 0.35, 0.15, 0.05],
                  backgroundColor: 'rgba(99, 102, 241, 0.7)'
                }]
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RandomForestAnalysis({ numCols }) {
  // Mock feature importance
  const features = numCols.slice(0, 5);
  const importance = features.map(() => Math.random());

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>랜덤 포레스트 (Random Forest)</h2>
        <p>여러 개의 의사결정나무를 앙상블하여 예측 성능을 높입니다.</p>
      </div>
      
      {features.length > 0 && (
        <div className="results-grid">
          <div className="result-card full-width">
            <div className="card-header">
              <h3><Layers size={20} /> 변수 중요도 (Feature Importance)</h3>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              <Bar 
                options={{ maintainAspectRatio: false, indexAxis: 'y' }}
                data={{
                  labels: features,
                  datasets: [{
                    label: '중요도',
                    data: importance,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)'
                  }]
                }}
              />
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>* 앙상블 모델 데모 시각화입니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
