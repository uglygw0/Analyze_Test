import React, { useState, useRef, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, RefreshCw, AlertTriangle, BarChart, X, Activity, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import {
    calculateMean,
    calculateMedian,
    calculateVariance,
    calculateStandardDeviation,
    calculateMode,
    calculateMin,
    calculateMax,
    calculateQuartilesAndOutliers
} from './utils/stats';
import { sampleCorrelation } from 'simple-statistics';

import { Chart as ChartJS, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';

// Chart.js 모듈 등록
ChartJS.register(CategoryScale, LinearScale, BoxPlotController, BoxAndWiskers, Tooltip, Legend);

function App() {
    const [data, setData] = useState(null);
    const [columns, setColumns] = useState([]);
    const [fileName, setFileName] = useState('');
    const [results, setResults] = useState({});
    const [isDragOver, setIsDragOver] = useState(false);

    // 모달 상태 관리
    const [outlierModalState, setOutlierModalState] = useState({ isOpen: false, colName: '', outliers: [] });
    // UI 토글 상태
    const [showBoxPlot, setShowBoxPlot] = useState(false);
    const [showCorrelation, setShowCorrelation] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100); // 줌 배율 관리 (초기값 100%)

    const chartRef = useRef(null);
    const boxplotContainerRef = useRef(null);
    const correlationRef = useRef(null);

    const downloadBoxplotImage = async () => {
        if (!boxplotContainerRef.current) return;
        try {
            const originalZoom = boxplotContainerRef.current.style.zoom;
            boxplotContainerRef.current.style.zoom = '100%'; 
            
            const canvas = await html2canvas(boxplotContainerRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true
            });
            
            boxplotContainerRef.current.style.zoom = originalZoom;
            const link = document.createElement('a');
            link.download = `boxplot_${fileName ? fileName.split('.')[0] : 'data'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("이미지 다운로드 중 오류 발생:", error);
            alert("이미지 다운로드에 실패했습니다.");
        }
    };

    const downloadCorrelationImage = async () => {
        if (!correlationRef.current) return;
        
        try {
            // 버튼들 텍스트를 임시로 살짝 변경하여 사용자에게 진행상태 피드백 고려가능
            // 혹은 transform scale/zoom 되어있는 상태라면 제대로 캡처가 안될 수 있으므로, 임시로 원래 크기로 복구하고 캡쳐 후 원복하는 로직 필요
            const originalTransform = correlationRef.current.style.transform;
            const originalZoom = correlationRef.current.style.zoom;
            
            correlationRef.current.style.transform = 'none';
            correlationRef.current.style.zoom = '100%'; // 다운로드 시에는 고화질을 위해 무조건 100% 배율로 복원

            const canvas = await html2canvas(correlationRef.current, {
                backgroundColor: '#ffffff', // 이미지화할때 뒷배경 투명 방지
                scale: 2,                   // 고해상도 처리를 위해 2배 스케일
                logging: false,
                useCORS: true               // 혹시 모를 외부 에셋 처리
            });
            
            correlationRef.current.style.transform = originalTransform;
            correlationRef.current.style.zoom = originalZoom;

            const link = document.createElement('a');
            link.download = `correlation_matrix_${fileName ? fileName.split('.')[0] : 'data'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("이미지 다운로드 중 오류 발생:", error);
            alert("이미지 다운로드에 실패했습니다. 관리자 툴이나 F12 개발자 모드 콘솔을 확인해주세요.");
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file) => {
        setFileName(file.name);
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            // Papa.parse를 사용해 CSV 데이터 파싱
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    const parsedData = results.data;
                    setData(parsedData);
                    if (parsedData.length > 0) {
                        const cols = Object.keys(parsedData[0]);
                        setColumns(cols);
                        analyzeData(parsedData, cols);
                    }
                }
            });
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            // FileReader와 xlsx 라이브러리를 사용해 엑셀 파일 로드
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                // 첫 번째 시트를 가져옴
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // JSON 형태로 변환
                const parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                setData(parsedData);
                if (parsedData.length > 0) {
                    const cols = Object.keys(parsedData[0]);
                    setColumns(cols);
                    analyzeData(parsedData, cols);
                }
            };
            reader.readAsBinaryString(file);
        } else {
            alert("지원하지 않는 파일 형식입니다. CSV 또는 엑셀(.xlsx, .xls) 파일을 업로드하세요.");
        }
    };

    const analyzeData = (dataset, cols) => {
        const analysisResults = {};

        cols.forEach(col => {
            const columnData = dataset.map(row => row[col]);

            const numberValues = columnData.map(v => Number(v)).filter(v => !isNaN(v) && v !== null && v !== '');
            const isNumeric = numberValues.length > 0 && numberValues.length > (columnData.length * 0.5);

            if (isNumeric) {
                const quartileData = calculateQuartilesAndOutliers(numberValues);

                analysisResults[col] = {
                    isText: false,
                    rawData: numberValues, // 박스플롯 및 상관계수용
                    mean: calculateMean(numberValues),
                    median: calculateMedian(numberValues),
                    variance: calculateVariance(numberValues),
                    stdDev: calculateStandardDeviation(numberValues),
                    mode: calculateMode(columnData),
                    min: calculateMin(numberValues),
                    max: calculateMax(numberValues),
                    q1: quartileData.q1,
                    q3: quartileData.q3,
                    iqr: quartileData.iqr,
                    outliers: quartileData.outliers
                };
            } else {
                analysisResults[col] = {
                    isText: true,
                    mode: calculateMode(columnData)
                };
            }
        });

        setResults(analysisResults);
    };

    const resetData = () => {
        setData(null);
        setColumns([]);
        setFileName('');
        setResults({});
        setShowBoxPlot(false);
        setShowCorrelation(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const openOutlierModal = (colName, outliers) => {
        setOutlierModalState({ isOpen: true, colName, outliers });
    };

    const closeOutlierModal = () => {
        setOutlierModalState({ isOpen: false, colName: '', outliers: [] });
    };

    // 수치형 변수들만 필터링 (메모이제이션)
    const numericColumns = useMemo(() => {
        return columns.filter(col => results[col] && !results[col].isText);
    }, [columns, results]);

    // 상관계수 계산 함수 (원본 데이터 기준 row-by-row 매칭)
    const calculateCorrelationMatrix = () => {
        if (!data || numericColumns.length === 0) return [];

        const matrix = [];
        for (let i = 0; i < numericColumns.length; i++) {
            const row = [];
            for (let j = 0; j < numericColumns.length; j++) {
                if (i === j) {
                    row.push(1);
                } else {
                    // 두 변수 모두 유효한 숫자인 행만 추출하여 상관계수 계산
                    const arr1 = [];
                    const arr2 = [];
                    data.forEach(item => {
                        const val1 = Number(item[numericColumns[i]]);
                        const val2 = Number(item[numericColumns[j]]);
                        if (!isNaN(val1) && !isNaN(val2)) {
                            arr1.push(val1);
                            arr2.push(val2);
                        }
                    });

                    if (arr1.length > 1) {
                        try {
                            row.push(sampleCorrelation(arr1, arr2));
                        } catch (e) {
                            row.push(null);
                        }
                    } else {
                        row.push(null);
                    }
                }
            }
            matrix.push(row);
        }
        return matrix;
    };

    const correlationMatrix = useMemo(() => showCorrelation ? calculateCorrelationMatrix() : [], [showCorrelation, data, numericColumns]);

    // 상관계수를 색상으로 변환하는 함수 (-1: 빨강, 0: 투명, 1: 파랑)
    const getCorrelationColor = (value) => {
        if (value === null || isNaN(value)) return 'transparent';
        if (value > 0) {
            return `rgba(99, 102, 241, ${Math.abs(value)})`; // Indigo 계열
        } else {
            return `rgba(239, 68, 68, ${Math.abs(value)})`; // Red 계열
        }
    };

    // BoxPlot 차트 렌더링을 위한 Effect
    useEffect(() => {
        if (showBoxPlot && chartRef.current && data) {
            // 기존 차트가 있다면 파괴
            if (chartRef.current.chartInstance) {
                chartRef.current.chartInstance.destroy();
            }

            const boxplotData = numericColumns.map(col => results[col].rawData);

            const ctx = chartRef.current.getContext('2d');
            const newChart = new ChartJS(ctx, {
                type: 'boxplot',
                data: {
                    labels: numericColumns,
                    datasets: [{
                        label: '수치형 변수 분포',
                        backgroundColor: 'rgba(99, 102, 241, 0.5)', // 박스 안쪽 색상 (Indigo)
                        borderColor: '#6366f1',                     // 박스 테두리
                        borderWidth: 1.5,
                        itemBackgroundColor: '#fff',
                        // 극단적인 데이터(이상치)를 뚜렷한 빨간색 동그라미로 표현
                        outlierBackgroundColor: '#ef4444',          // 이상치 내부 색상 (Red)
                        outlierBorderColor: '#dc2626',              // 이상치 테두리 (Dark Red)
                        outlierRadius: 4,                           // 이상치 동그라미 크기
                        data: boxplotData
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // 붕 떠있는 불필요한 범례(네모 상자) 숨김
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.dataset.label || '';
                                    const raw = context.raw;
                                    return `${label} - 최소값:${raw.min}, Q1:${raw.q1}, 중앙값:${raw.median}, Q3:${raw.q3}, 최대값:${raw.max}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: '#334155', // 밝은 모드 배경에 맞게 라벨이 보이도록 어두운 색으로 수정
                                font: { size: 12, weight: 'bold' } // 박스 밑의 이름을 명확하게
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' } // 그리드 라인도 밝은 테마에 맞춤
                        },
                        y: {
                            ticks: { color: '#334155' },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });
            chartRef.current.chartInstance = newChart;
        }
    }, [showBoxPlot, columns, results, data, numericColumns]);

    return (
        <div className="container">
            <header className="header">
                <h1>민관우의 데이터 분석기</h1>
                <p>복잡한 수식을 고민할 필요 없이, CSV/엑셀 파일을 업로드하여 변수별 통계치, 박스플롯, 상관계수를 편하게 확인하세요.</p>
            </header>

            {!data ? (
                <div
                    className={`upload-container ${isDragOver ? 'drag-over' : ''}`}
                    style={{ borderColor: isDragOver ? 'var(--primary-color)' : '' }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        className="file-input"
                        onChange={handleFileUpload}
                    />
                    <UploadCloud className="upload-icon" />
                    <div className="upload-text">
                        <h3>클릭하거나 파일을 여기에 드롭하세요</h3>
                        <p>지원 형식: CSV, Excel (.xlsx, .xls)</p>
                    </div>
                </div>
            ) : (
                <main className="results-section">
                    <div className="file-info" style={{ flexWrap: 'wrap', gap: '16px' }}>
                        <div className="file-name-wrap">
                            <FileSpreadsheet size={24} color="var(--success-color)" />
                            <span className="file-name">{fileName}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {showCorrelation && (
                                <button
                                    className="btn-reset"
                                    style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                    onClick={downloadCorrelationImage}
                                >
                                    <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                    행렬 이미지 다운로드
                                </button>
                            )}

                            <button
                                className="btn-reset"
                                style={{ background: showCorrelation ? 'rgba(236, 72, 153, 0.4)' : 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}
                                onClick={() => {
                                    setShowBoxPlot(false);
                                    setShowCorrelation(!showCorrelation);
                                }}
                            >
                                <Activity size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {showCorrelation ? '상관계수 닫기' : '상관계수 보기'}
                            </button>

                            <button
                                className="btn-reset"
                                style={{ background: showBoxPlot ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                                onClick={() => {
                                    setShowCorrelation(false);
                                    setShowBoxPlot(!showBoxPlot);
                                }}
                            >
                                <BarChart size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {showBoxPlot ? 'Box Plot 닫기' : 'Box Plot 보기'}
                            </button>

                            <button className="btn-reset" onClick={resetData}>
                                <RefreshCw size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                새로운 파일
                            </button>
                        </div>
                    </div>

                    {/* 박스 플롯 영역 */}
                    {showBoxPlot && (
                        <div className="chart-container" style={{ margin: '20px 0', padding: '20px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.5s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <h3 style={{ marginBottom: '8px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <BarChart size={20} /> 수치형 변수 박스플롯 (Box Plot)
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>각 박스는 아래쪽부터 최소값, 1사분위(Q1), 중앙값(가운데 선), 3사분위(Q3), 최대값을 의미합니다.</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>크기 조절: {zoomLevel}%</span>
                                        <input
                                            type="range"
                                            min="20"
                                            max="150"
                                            value={zoomLevel}
                                            onChange={(e) => setZoomLevel(e.target.value)}
                                            style={{ width: '120px', cursor: 'grab' }}
                                        />
                                        <button
                                            className="btn-reset"
                                            style={{ background: '#f1f5f9', color: 'var(--text-muted)', padding: '6px 12px', border: '1px solid rgba(100, 116, 139, 0.2)', fontSize: '0.8rem' }}
                                            onClick={() => setZoomLevel(100)}
                                        >
                                            원래대로
                                        </button>
                                    </div>
                                    <button
                                        className="btn-reset"
                                        style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                        onClick={downloadBoxplotImage}
                                    >
                                        <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                        차트 이미지 다운로드
                                    </button>
                                </div>
                            </div>

                            <div ref={boxplotContainerRef} style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', zoom: `${zoomLevel}%` }}>
                                <div style={{ height: '500px', display: 'flex', justifyContent: 'center' }}>
                                    <canvas ref={chartRef}></canvas>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 상관계수 플롯(행렬) 영역 */}
                    {showCorrelation && (
                        <div className="correlation-container" style={{ margin: '20px 0', padding: '20px', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflowX: 'auto', animation: 'fadeIn 0.5s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <h3 style={{ marginBottom: '8px', color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={20} /> 수치형 변수간 피어슨 상관계수 (Pearson Correlation)
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>1에 가까울수록 양의 상관관계(파랑), -1에 가까울수록 음의 상관관계(빨강)를 의미합니다.</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>크기 조절: {zoomLevel}%</span>
                                    <input
                                        type="range"
                                        min="20"
                                        max="150"
                                        value={zoomLevel}
                                        onChange={(e) => setZoomLevel(e.target.value)}
                                        style={{ width: '120px', cursor: 'grab' }}
                                    />
                                    <button
                                        className="btn-reset"
                                        style={{ background: '#f1f5f9', color: 'var(--text-muted)', padding: '6px 12px', border: '1px solid rgba(100, 116, 139, 0.2)', fontSize: '0.8rem' }}
                                        onClick={() => setZoomLevel(100)}
                                    >
                                        원래대로
                                    </button>
                                </div>
                            </div>

                            <div ref={correlationRef} style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', minWidth: 'max-content', zoom: `${zoomLevel}%` }}>
                                {numericColumns.length < 2 ? (
                                    <p style={{ color: '#fca5a5' }}>상관관계를 분석하기 위해서는 수치형 변수가 2개 이상 필요합니다.</p>
                                ) : (
                                    <table className="analysis-table compact-matrix" style={{ width: 'max-content', minWidth: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th>변수명</th>
                                                {numericColumns.map(col => <th key={col} style={{ textAlign: 'center' }}>{col}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {numericColumns.map((rowCol, i) => (
                                                <tr key={rowCol}>
                                                    <th style={{ background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{rowCol}</th>
                                                    {numericColumns.map((col, j) => {
                                                        const val = correlationMatrix[i][j];
                                                        const bgColor = getCorrelationColor(val);
                                                        return (
                                                            <td
                                                                key={col}
                                                                style={{
                                                                    background: bgColor,
                                                                    textAlign: 'center',
                                                                    fontWeight: i === j ? 'bold' : 'normal',
                                                                    color: (val !== null && Math.abs(val) > 0.5) ? '#fff' : 'var(--text-light)',
                                                                    border: '1px solid rgba(255,255,255,0.05)'
                                                                }}
                                                                title={`${rowCol} ↔ ${col}`}
                                                            >
                                                                {val !== null ? val.toFixed(2) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="table-container" style={{ display: (!showBoxPlot && !showCorrelation) ? 'block' : 'none' }}>
                        <table className="analysis-table">
                            <thead>
                                <tr>
                                    <th>변수명</th>
                                    <th>타입</th>
                                    <th>최솟값</th>
                                    <th>1사분위(Q1)</th>
                                    <th>중앙값</th>
                                    <th>평균</th>
                                    <th>3사분위(Q3)</th>
                                    <th>최댓값</th>
                                    <th>표준편차</th>
                                    <th>최빈값</th>
                                    <th>이상치 (Outliers)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns.map(col => {
                                    const res = results[col];
                                    if (!res) return null;

                                    if (res.isText) {
                                        return (
                                            <tr key={col}>
                                                <td className="col-name">{col}</td>
                                                <td><span className="badge badge-text">문자형</span></td>
                                                <td colSpan="7" className="text-muted">- 수치 데이터 아님 -</td>
                                                <td className="ellipsis-cell" title={res.mode}>{res.mode || '-'}</td>
                                                <td className="text-muted">-</td>
                                            </tr>
                                        );
                                    }

                                    const formatNum = (num) => num !== null && num !== undefined ? Number(num).toFixed(2) : '-';

                                    return (
                                        <tr key={col}>
                                            <td className="col-name">{col}</td>
                                            <td><span className="badge badge-numeric">수치형</span></td>
                                            <td>{formatNum(res.min)}</td>
                                            <td>{formatNum(res.q1)}</td>
                                            <td className="highlight-cell">{formatNum(res.median)}</td>
                                            <td className="highlight-cell focus">{formatNum(res.mean)}</td>
                                            <td>{formatNum(res.q3)}</td>
                                            <td>{formatNum(res.max)}</td>
                                            <td>{formatNum(res.stdDev)}</td>
                                            <td className="ellipsis-cell" title={res.mode}>{res.mode !== null ? res.mode : '-'}</td>
                                            <td className="outliers-cell">
                                                {res.outliers?.length > 0 ? (
                                                    <button
                                                        className="outliers-badge-btn"
                                                        onClick={() => openOutlierModal(col, res.outliers)}
                                                        title="클릭하여 이상치 리스트 보기"
                                                    >
                                                        <AlertTriangle size={14} />
                                                        <span>{res.outliers.length}개 보기</span>
                                                    </button>
                                                ) : <span style={{ color: "var(--text-muted)" }}>-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {columns.length === 0 && (
                        <div className="empty-state">
                            데이터를 분석할 수 있는 열이 없습니다. 파일 형식을 확인해주세요.
                        </div>
                    )}
                </main>
            )}

            {/* 이상치 모달 팝업 */}
            {outlierModalState.isOpen && (
                <div className="modal-overlay" onClick={closeOutlierModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><span style={{ color: "var(--primary-color)" }}>{outlierModalState.colName}</span> 변수의 이상치 목록</h2>
                            <button className="modal-close" onClick={closeOutlierModal}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="outliers-grid">
                                {outlierModalState.outliers.map((val, idx) => (
                                    <div key={idx} className="outlier-item">
                                        {typeof val === 'number' ? val.toFixed(4).replace(/\.?0+$/, '') : val}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <p>총 {outlierModalState.outliers.length}개의 이상치 (Q1 - 1.5*IQR 이하 또는 Q3 + 1.5*IQR 이상인 값)</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
