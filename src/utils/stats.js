// 배열 안에서 숫자만 골라내는 헬퍼 함수
const extractNumbers = (arr) => arr.map(v => Number(v)).filter(v => !isNaN(v));

// 1. 평균값(Mean)
export const calculateMean = (data) => {
    const nums = extractNumbers(data);
    if (nums.length === 0) return null;
    const sum = nums.reduce((acc, val) => acc + val, 0);
    return sum / nums.length;
};

// 2. 중앙값(Median)
export const calculateMedian = (data) => {
    const nums = extractNumbers(data).sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);

    if (nums.length % 2 === 0) {
        return (nums[mid - 1] + nums[mid]) / 2;
    }
    return nums[mid];
};

// 최솟값(Min)
export const calculateMin = (data) => {
    const nums = extractNumbers(data);
    if (nums.length === 0) return null;
    return Math.min(...nums);
}

// 최댓값(Max)
export const calculateMax = (data) => {
    const nums = extractNumbers(data);
    if (nums.length === 0) return null;
    return Math.max(...nums);
}

// 사분위수 (Q1, Q3 & IQR) 및 이상치 계산
export const calculateQuartilesAndOutliers = (data) => {
    const nums = extractNumbers(data).sort((a, b) => a - b);
    if (nums.length < 4) return { q1: null, q3: null, iqr: null, outliers: [], lowerBound: null, upperBound: null };

    const getPercentile = (arr, q) => {
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) {
            return arr[base] + rest * (arr[base + 1] - arr[base]);
        } else {
            return arr[base];
        }
    };

    const q1 = getPercentile(nums, 0.25);
    const q3 = getPercentile(nums, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // 이상치 판별
    const outliers = nums.filter(x => x < lowerBound || x > upperBound);

    return { q1, q3, iqr, lowerBound, upperBound, outliers };
};

// 3. 분산(Variance) - 표본 분산
export const calculateVariance = (data) => {
    const nums = extractNumbers(data);
    if (nums.length <= 1) return 0;

    const mean = calculateMean(nums);
    const squaredDiffs = nums.map(value => Math.pow(value - mean, 2));
    const sumSquaredDiffs = squaredDiffs.reduce((acc, val) => acc + val, 0);

    return sumSquaredDiffs / (nums.length - 1);
};

// 4. 표준편차(Standard Deviation)
export const calculateStandardDeviation = (data) => {
    const variance = calculateVariance(data);
    if (variance === null) return null;
    return Math.sqrt(variance);
};

// 5. 최빈값(Mode)
export const calculateMode = (data) => {
    if (data.length === 0) return null;

    const frequencyMap = {};
    let maxFreq = 0;
    let modes = [];

    data.forEach((val) => {
        // 빈 값은 제외
        if (val === null || val === undefined || val === '') return;

        if (frequencyMap[val]) {
            frequencyMap[val]++;
        } else {
            frequencyMap[val] = 1;
        }

        if (frequencyMap[val] > maxFreq) {
            maxFreq = frequencyMap[val];
            modes = [val];
        } else if (frequencyMap[val] === maxFreq) {
            if (!modes.includes(val)) modes.push(val);
        }
    });

    if (modes.length === 0) return null;
    return modes.join(', ');
};
