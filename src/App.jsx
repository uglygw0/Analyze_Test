import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  Database, 
  BarChart2, 
  PieChart, 
  TrendingUp, 
  Activity, 
  Layers, 
  FileSpreadsheet,
  Network,
  AlertCircle,
  Settings,
  Scissors
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Scatter, Line, Bar } from 'react-chartjs-2';
import { SimpleLinearRegression } from 'ml-regression-simple-linear';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import { kmeans } from 'ml-kmeans';
import { PCA } from 'ml-pca';
import { PLS } from 'ml-pls';
import { LassoRegression } from 'ml-regression-lasso';
import { Matrix } from 'ml-matrix';

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
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
      if (values.length === 0) return false;
      
      // 모든 값이 숫자인지 확인
      const isNumeric = values.every(v => typeof v === 'number');
      if (!isNumeric) return false;

      // 0 또는 1의 값만 가지는 경우 분류형 데이터로 간주하여 소거
      const uniqueValues = Array.from(new Set(values));
      const isBinary = uniqueValues.length <= 2 && uniqueValues.every(v => v === 0 || v === 1);
      
      return !isBinary;
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
        >
          <UploadCloud className="upload-icon" size={32} />
          <div className="upload-text">
            <h3>파일 업로드</h3>
            <p>CSV, Excel 파일 드롭</p>
          </div>
          <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} />
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
          <div className="chart-container" style={{ height: '400px' }}>
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
          <div className="chart-container" style={{ height: '400px' }}>
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
            <div className="chart-container" style={{ height: '500px' }}>
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
            <div className="chart-container" style={{ height: '400px' }}>
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
  const [method, setMethod] = useState('ols'); // ols, ridge, lasso, pca, pls
  const [testSize, setTestSize] = useState(0.2);
  const [lambda, setLambda] = useState(0.1);
  const [nComponents, setNComponents] = useState(2);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleXVar = (col) => {
    setXVars(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const calculateMetrics = (actual, predicted) => {
    let ssTotal = 0;
    let ssRes = 0;
    let mae = 0;
    const yMean = actual.reduce((a, b) => a + b, 0) / actual.length;
    
    actual.forEach((val, i) => {
      ssTotal += Math.pow(val - yMean, 2);
      ssRes += Math.pow(val - predicted[i], 2);
      mae += Math.abs(val - predicted[i]);
    });

    const r2 = ssTotal === 0 ? 0 : 1 - (ssRes / ssTotal);
    const mse = ssRes / actual.length;
    const rmse = Math.sqrt(mse);
    mae = mae / actual.length;

    return { r2, mse, rmse, mae };
  };

  const runAnalysis = () => {
    if (!yVar || xVars.length === 0) return;
    setLoading(true);
    
    setTimeout(() => {
      try {
        const allX = [];
        const allY = [];
        data.forEach(row => {
          let valid = Number.isFinite(row[yVar]);
          xVars.forEach(col => { 
            if (!Number.isFinite(row[col])) valid = false; 
          });
          if (valid) {
            allY.push(row[yVar]);
            allX.push(xVars.map(col => row[col]));
          }
        });

        if (allX.length < 5) {
          alert("데이터가 너무 적습니다 (최소 5행 필요). 현재 유효 데이터: " + allX.length + "행");
          setLoading(false);
          return;
        }

        // Check for constant columns (Zero variance)
        const constantCols = [];
        xVars.forEach((col, idx) => {
          const vals = allX.map(r => r[idx]);
          const unique = new Set(vals);
          if (unique.size <= 1) constantCols.push(col);
        });

        if (constantCols.length > 0) {
          alert(`분석 불가: 다음 변수들의 값이 모두 동일(분산 0)합니다: ${constantCols.join(', ')}. 이 변수들을 제외하고 다시 시도해 주세요.`);
          setLoading(false);
          return;
        }

        // Train/Test Split
        const indices = Array.from({length: allX.length}, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const trainCount = Math.floor(allX.length * (1 - testSize));
        const trainIndices = indices.slice(0, trainCount);
        const testIndices = indices.slice(trainCount);

        const xTrain = trainIndices.map(i => allX[i]);
        const yTrain = trainIndices.map(i => allY[i]);
        const xTest = testIndices.map(i => allX[i]);
        const yTest = testIndices.map(i => allY[i]);

        let predictor, trainPredicted, testPredicted, featureInfo = null;

        if (method === 'ols') {
          const reg = new MultivariateLinearRegression(xTrain, yTrain.map(y => [y]));
          predictor = (x) => reg.predict(x)[0];
          // Standardized coefficients proxy
          featureInfo = xVars.map((col, idx) => {
            const vals = xTrain.map(r => r[idx]);
            const stdDev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - (vals.reduce((s,v)=>s+v,0)/vals.length), 2), 0) / vals.length);
            const coef = reg.weights[idx + 1][0];
            return { col, impact: Math.abs(coef * stdDev), rawCoef: coef };
          }).sort((a,b) => b.impact - a.impact);
        } 
        else if (method === 'ridge') {
          const X = new Matrix(xTrain);
          const Y = new Matrix(yTrain.map(y => [y]));
          // Add intercept
          const XWithIntercept = Matrix.ones(X.rows, X.columns + 1);
          XWithIntercept.setSubMatrix(X, 0, 1);
          
          const XT = XWithIntercept.transpose();
          const XTX = XT.mmul(XWithIntercept);
          const identity = Matrix.eye(XTX.rows);
          identity.set(0, 0, 0); // Don't regularize intercept
          const lambdaI = identity.mul(lambda);
          
          // Regularized inverse
          const weights = XTX.add(lambdaI).inverse().mmul(XT).mmul(Y);
          
          predictor = (x) => {
            let sum = weights.get(0, 0);
            x.forEach((val, i) => sum += weights.get(i + 1, 0) * val);
            return sum;
          };

          featureInfo = xVars.map((col, idx) => {
            const vals = xTrain.map(r => r[idx]);
            const stdDev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - (vals.reduce((s,v)=>s+v,0)/vals.length), 2), 0) / vals.length);
            const coef = weights.get(idx + 1, 0);
            return { col, impact: Math.abs(coef * stdDev), rawCoef: coef };
          }).sort((a,b) => b.impact - a.impact);
        }
        else if (method === 'lasso') {
          // Lasso expects 2D array for y
          const reg = new LassoRegression(xTrain, yTrain.map(y => [y]), { lambda: lambda });
          predictor = (x) => reg.predict([x])[0][0];
          
          featureInfo = xVars.map((col, idx) => {
            const coef = reg.weights[idx][0];
            return { col, impact: Math.abs(coef), rawCoef: coef };
          }).sort((a,b) => b.impact - a.impact);
        }
        else if (method === 'pca') {
          const actualComponents = Math.min(nComponents, xVars.length, xTrain.length - 1);
          const pca = new PCA(xTrain);
          // 주성분 결과에서 사용자가 지정한 개수만큼만 슬라이싱하여 사용
          const fullTrainPca = pca.predict(xTrain).to2DArray();
          const xTrainPcaSlice = fullTrainPca.map(row => row.slice(0, actualComponents));
          
          const reg = new MultivariateLinearRegression(xTrainPcaSlice, yTrain.map(y => [y]));
          
          predictor = (x) => {
            const fullXPca = pca.predict([x]).to2DArray()[0];
            const xPcaSlice = fullXPca.slice(0, actualComponents);
            return reg.predict([xPcaSlice])[0];
          };

          // PCA Loadings (상위 성분에 대해서만 표시)
          const loadings = pca.getLoadings().toArray();
          featureInfo = {
            type: 'pca',
            components: loadings.slice(0, actualComponents).map((comp, i) => ({
              label: `PC${i+1}`,
              contributions: comp.map((val, j) => ({ col: xVars[j], val }))
            })),
            explainedVariance: pca.getExplainedVariance().slice(0, actualComponents)
          };
        }
        else if (method === 'pls') {
          const actualComponents = Math.min(nComponents, xVars.length, xTrain.length - 1);
          const pls = new PLS(xTrain, yTrain.map(y => [y]), { nComponents: actualComponents });
          predictor = (x) => {
            const res = pls.predict([x]);
            return Array.isArray(res[0]) ? res[0][0] : res[0];
          };
          
          // Get coefficients by predicting on unit vectors (proxy for importance)
          const meanX = xVars.map((_, idx) => xTrain.reduce((s, r) => s + r[idx], 0) / xTrain.length);
          const basePred = predictor(meanX);
          featureInfo = xVars.map((col, idx) => {
            const perturbedX = [...meanX];
            perturbedX[idx] += 1;
            const diff = predictor(perturbedX) - basePred;
            return { col, impact: Math.abs(diff), rawCoef: diff };
          }).sort((a,b) => b.impact - a.impact);
        }

        trainPredicted = xTrain.map(x => predictor(x));
        testPredicted = xTest.map(x => predictor(x));

        const trainMetrics = calculateMetrics(yTrain, trainPredicted);
        const testMetrics = calculateMetrics(yTest, testPredicted);

        const trainResiduals = yTrain.map((y, i) => ({ predicted: trainPredicted[i], residual: y - trainPredicted[i] }));
        const testResiduals = yTest.map((y, i) => ({ predicted: testPredicted[i], residual: y - testPredicted[i] }));

        setModel({
          method,
          xVars,
          trainMetrics,
          testMetrics,
          trainResiduals,
          testResiduals,
          featureInfo,
          actualVsPredicted: {
            train: yTrain.map((y, i) => ({ x: y, y: trainPredicted[i] })),
            test: yTest.map((y, i) => ({ x: y, y: testPredicted[i] }))
          },
          minY: Math.min(...allY),
          maxY: Math.max(...allY)
        });
      } catch (e) {
        console.error(e);
        alert("분석 오류 상세: " + e.message + "\n\n데이터에 결측치나 계산 불가능한 값이 포함되어 있을 수 있습니다.");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="fade-in">
      <div className="workspace-header">
        <h2>고급 다중 회귀분석 (Advanced Multiple Regression)</h2>
        <p>OLS, Ridge, Lasso, PCA/PLS 등 다양한 기법을 통한 정밀 분석을 수행합니다.</p>
      </div>

      <div className="control-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="input-group">
          <label><Database size={14} /> 종속변수 (Y)</label>
          <select value={yVar} onChange={e => setYVar(e.target.value)}>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label><Settings size={14} /> 분석 방법</label>
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option value="ols">일반 최소자승법 (OLS)</option>
            <option value="ridge">릿지 회귀 (Ridge - L2)</option>
            <option value="lasso">라쏘 회귀 (Lasso - L1)</option>
            <option value="pca">PCA 기반 회귀 (Principal Component)</option>
            <option value="pls">PLS 기반 회귀 (Partial Least Squares)</option>
          </select>
        </div>

        <div className="input-group">
          <label><Scissors size={14} /> 테스트 데이터 비율 ({Math.round(testSize * 100)}%)</label>
          <input type="range" min="0.1" max="0.5" step="0.05" value={testSize} onChange={e => setTestSize(parseFloat(e.target.value))} />
        </div>

        {(method === 'ridge' || method === 'lasso') && (
          <div className="input-group">
            <label><Activity size={14} /> 규제 강도 (Lambda: {lambda})</label>
            <input type="number" step="0.01" value={lambda} onChange={e => setLambda(parseFloat(e.target.value))} />
          </div>
        )}

        {(method === 'pca' || method === 'pls') && (
          <div className="input-group">
            <label><Layers size={14} /> 주성분 개수 ({nComponents})</label>
            <input type="number" min="1" max={xVars.length || 1} value={nComponents} onChange={e => setNComponents(parseInt(e.target.value))} />
          </div>
        )}
      </div>

      <div className="control-panel" style={{ marginTop: '10px' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>독립변수 (X들) 선택</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
            {numCols.filter(c => c !== yVar).map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: xVars.includes(c) ? '#eff6ff' : 'transparent', padding: '4px 8px', borderRadius: '4px' }}>
                <input type="checkbox" checked={xVars.includes(c)} onChange={() => toggleXVar(c)} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{c}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={runAnalysis} disabled={xVars.length === 0 || loading} style={{ alignSelf: 'flex-end', height: '45px' }}>
          {loading ? '분석 중...' : <><Layers size={18} /> 분석 실행</>}
        </button>
      </div>

      {model && (
        <div className="results-grid fade-in">
          {/* Performance Comparison */}
          <div className="result-card full-width">
            <div className="card-header">
              <h3><TrendingUp size={20} /> 모델 성능 평가 (Train vs Test)</h3>
            </div>
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="metric-box">
                <div className="metric-label">Train R²</div>
                <div className="metric-value" style={{ color: '#6366f1' }}>{model.trainMetrics.r2.toFixed(4)}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Test R²</div>
                <div className="metric-value" style={{ color: '#ec4899' }}>{model.testMetrics.r2.toFixed(4)}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Test RMSE</div>
                <div className="metric-value">{model.testMetrics.rmse.toFixed(4)}</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Test MAE</div>
                <div className="metric-value">{model.testMetrics.mae.toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="result-card">
            <div className="card-header">
              <h3><Network size={20} /> 실제값 vs 예측값 Comparison</h3>
            </div>
            <div className="chart-container" style={{ height: '450px' }}>
              <Scatter 
                options={{ 
                  maintainAspectRatio: false,
                  scales: { x: { title: { display: true, text: '실제값 (Actual)' } }, y: { title: { display: true, text: '예측값 (Predicted)' } } }
                }}
                data={{
                  datasets: [
                    {
                      type: 'line',
                      label: 'y=x',
                      data: [{ x: model.minY, y: model.minY }, { x: model.maxY, y: model.maxY }],
                      borderColor: '#94a3b8',
                      borderWidth: 1,
                      borderDash: [5, 5],
                      pointRadius: 0
                    },
                    {
                      label: '학습 데이터 (Train)',
                      data: model.actualVsPredicted.train,
                      backgroundColor: 'rgba(99, 102, 241, 0.5)'
                    },
                    {
                      label: '평가 데이터 (Test)',
                      data: model.actualVsPredicted.test,
                      backgroundColor: 'rgba(236, 72, 153, 0.7)'
                    }
                  ]
                }}
              />
            </div>
          </div>

          <div className="result-card">
            <div className="card-header">
              <h3><AlertCircle size={20} /> 잔차 분석 (Residual Analysis)</h3>
            </div>
            <div className="chart-container" style={{ height: '450px' }}>
              <Scatter 
                options={{ 
                  maintainAspectRatio: false,
                  scales: { x: { title: { display: true, text: '예측값 (Predicted)' } }, y: { title: { display: true, text: '잔차 (Residual)' } } }
                }}
                data={{
                  datasets: [
                    {
                      type: 'line',
                      label: 'Zero Line',
                      data: [{ x: model.minY, y: 0 }, { x: model.maxY, y: 0 }],
                      borderColor: '#10b981',
                      borderWidth: 2,
                      pointRadius: 0
                    },
                    {
                      label: 'Train Residuals',
                      data: model.trainResiduals.map(r => ({ x: r.predicted, y: r.residual })),
                      backgroundColor: 'rgba(99, 102, 241, 0.4)'
                    },
                    {
                      label: 'Test Residuals',
                      data: model.testResiduals.map(r => ({ x: r.predicted, y: r.residual })),
                      backgroundColor: 'rgba(245, 158, 11, 0.7)'
                    }
                  ]
                }}
              />
            </div>
          </div>

          <div className="result-card full-width">
            <div className="card-header">
              <h3><BarChart2 size={20} /> 
                {method === 'pca' ? '주성분 분석 (PCA Contributions)' : 
                 method === 'pls' ? '변수 중요도 (PLS Importance)' : 
                 '변수 영향도 (Feature Impact)'}
              </h3>
            </div>
            {method === 'pca' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {model.featureInfo.components.map((comp, idx) => (
                  <div key={idx} style={{ height: '400px' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>{comp.label} (설명력: {(model.featureInfo.explainedVariance[idx] * 100).toFixed(1)}%)</h4>
                    <Bar 
                      options={{ maintainAspectRatio: false, indexAxis: 'y' }}
                      data={{
                        labels: comp.contributions.map(c => c.col),
                        datasets: [{
                          label: '기여도',
                          data: comp.contributions.map(c => c.val),
                          backgroundColor: '#6366f1'
                        }]
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-container" style={{ height: '450px' }}>
                <Bar 
                  options={{ maintainAspectRatio: false, indexAxis: 'y' }}
                  data={{
                    labels: model.featureInfo.map(i => i.col),
                    datasets: [{
                      label: '영향도/중요도',
                      data: model.featureInfo.map(i => i.impact),
                      backgroundColor: model.featureInfo.map(i => i.rawCoef >= 0 ? 'rgba(99, 102, 241, 0.7)' : 'rgba(236, 72, 153, 0.7)'),
                    }]
                  }}
                />
              </div>
            )}
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              * {method === 'ols' || method === 'ridge' ? '표준화된 계수 기반의 상대적 영향도입니다.' : 
                 method === 'lasso' ? '절댓값 계수 기반의 변수 선택 결과입니다.' : 
                 method === 'pca' ? '각 주성분에 대한 원래 변수들의 기여도(Loading)입니다.' : 
                 'PLS 가중치 기반의 변수 중요도입니다.'}
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

          <div className="result-card full-width">
            <div className="card-header">
              <h3><Network size={20} /> ROC Curve (Mock)</h3>
            </div>
            <div className="chart-container" style={{ height: '450px' }}>
              <Line 
                options={{ maintainAspectRatio: false, scales: { x: { min: 0, max: 1, title: { display: true, text: 'False Positive Rate' } }, y: { min: 0, max: 1, title: { display: true, text: 'True Positive Rate' } } } }}
                data={{
                  labels: [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1],
                  datasets: [{
                    label: 'ROC 커브',
                    data: [0, 0.6, 0.8, 0.9, 0.95, 0.99, 1],
                    borderColor: '#ec4899',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(236, 72, 153, 0.1)'
                  }, {
                    label: '무작위 예측 (AUC=0.5)',
                    data: [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1],
                    borderColor: '#cbd5e1',
                    borderDash: [5, 5],
                    pointRadius: 0
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
          <div className="result-card">
            <div className="card-header">
              <h3><BarChart2 size={20} /> 원본 데이터 분포</h3>
            </div>
            <div className="chart-container">
              <Scatter 
                options={{ 
                  maintainAspectRatio: false, 
                  plugins: { legend: { display: false } },
                  scales: { x: { title: { display: true, text: xVar } }, y: { title: { display: true, text: yVar } } }
                }}
                data={{
                  datasets: [{
                    label: '데이터 포인트',
                    data: model.points.map(p => ({ x: p[0], y: p[1] })),
                    backgroundColor: 'rgba(156, 163, 175, 0.6)'
                  }]
                }}
              />
            </div>
          </div>

          <div className="result-card">
            <div className="card-header">
              <h3><PieChart size={20} /> K-Means 군집 결과</h3>
            </div>
            <div className="chart-container">
              <Scatter 
                options={{ 
                  maintainAspectRatio: false,
                  scales: { x: { title: { display: true, text: xVar } }, y: { title: { display: true, text: yVar } } }
                }}
                data={{
                  datasets: [
                    ...Array.from({length: model.k}, (_, i) => ({
                      label: `Cluster ${i + 1}`,
                      data: model.points.filter((_, idx) => model.clusters[idx] === i).map(p => ({ x: p[0], y: p[1] })),
                      backgroundColor: colors[i % colors.length]
                    })),
                    {
                      label: '기준점 (Centroids)',
                      data: model.centroids.map(c => ({ x: c[0], y: c[1] })),
                      backgroundColor: '#18181b', // 매우 진한 회색/검정
                      pointStyle: 'star',
                      pointRadius: 10,
                      pointHoverRadius: 13,
                      borderWidth: 2,
                      borderColor: '#ffffff'
                    }
                  ]
                }}
              />
            </div>
          </div>
          
          <div className="result-card full-width">
            <div className="card-header">
              <h3><BarChart2 size={20} /> 군집별 데이터 개수 (Cluster Sizes)</h3>
            </div>
            <div className="chart-container" style={{ height: '400px' }}>
              <Bar 
                options={{ maintainAspectRatio: false }}
                data={{
                  labels: Array.from({length: model.k}, (_, i) => `Cluster ${i + 1}`),
                  datasets: [{
                    label: '데이터 개수',
                    data: model.clusterCounts,
                    backgroundColor: colors.slice(0, model.k)
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
          <div className="chart-container" style={{ height: '400px' }}>
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
            <div className="chart-container" style={{ height: '450px' }}>
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

          <div className="result-card full-width">
            <div className="card-header">
              <h3><TrendingUp size={20} /> OOB (Out-of-Bag) Error 추이 (Mock)</h3>
            </div>
            <div className="chart-container" style={{ height: '450px' }}>
              <Line 
                options={{ maintainAspectRatio: false, scales: { x: { title: { display: true, text: '트리의 수 (Number of Trees)' } }, y: { title: { display: true, text: '오차율 (Error Rate)' } } } }}
                data={{
                  labels: [10, 20, 30, 40, 50, 70, 100],
                  datasets: [{
                    label: 'OOB Error',
                    data: [0.35, 0.28, 0.22, 0.20, 0.18, 0.17, 0.165],
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)'
                  }]
                }}
              />
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>* 트리의 수가 증가함에 따라 오차율이 어떻게 안정화되는지 보여줍니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
