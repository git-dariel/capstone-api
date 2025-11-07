# Mental Health Prediction History Tracking Implementation

## Overview

The mental health prediction system has been refactored to support **prediction history tracking**. Instead of storing a single `mentalHealthPrediction` object, the system now maintains an array of `MentalHealthPredictionRecord` entries, allowing students and counselors to track prediction trends over time.

## Database Schema Changes

### Previous Structure

```prisma
model IndividualInventory {
  // ... other fields
  mentalHealthPrediction: MentalHealthPrediction?
  predictionGenerated: Boolean
  predictionUpdatedAt: DateTime?
}
```

### New Structure

```prisma
model IndividualInventory {
  // ... other fields
  mentalHealthPredictions: MentalHealthPredictionRecord[]  // Array relationship
  predictionGenerated: Boolean
  predictionUpdatedAt: DateTime?
}

model MentalHealthPredictionRecord {
  id: String
  inventory: IndividualInventory (relation)
  inventoryId: String
  academicPerformanceOutlook: AcademicPerformanceOutlook
  confidence: Float
  modelAccuracy: ModelAccuracy
  riskFactors: String[]
  mentalHealthRisk: MentalHealthRisk
  inputData: Json
  recommendations: String[]
  predictionDate: DateTime @default(now())
  isDeleted: Boolean @default(false)
  createdAt: DateTime @default(now())
  updatedAt: DateTime @updatedAt
}
```

## Key Features

✅ **Multiple Predictions Per Student** - Track prediction history over time  
✅ **Soft Delete Support** - Mark predictions as deleted without data loss  
✅ **Audit Trail** - `createdAt`, `updatedAt` fields for tracking changes  
✅ **Prediction Timestamps** - `predictionDate` field for when prediction was generated  
✅ **Backward Compatible Metadata** - `predictionGenerated` and `predictionUpdatedAt` still exist on inventory for quick queries

## API Changes

### 1. Creating a Prediction (`POST /api/inventory/{studentId}/predict`)

**Behavior Change:** Instead of replacing the previous prediction, a new `MentalHealthPredictionRecord` is **created and appended** to the array.

**Request Body:** Remains the same

**Response Structure:**

```json
{
  "message": "Mental health prediction completed successfully",
  "disclaimer": "⚠️ IMPORTANT NOTICE: ...",
  "studentId": "student-id",
  "inventory": {
    "id": "inventory-id",
    "mentalHealthPredictions": [
      {
        "id": "prediction-record-id",
        "academicPerformanceOutlook": "improved",
        "confidence": 0.85,
        "modelAccuracy": {
          "decisionTree": 0.823,
          "randomForest": 0.871
        },
        "riskFactors": [...],
        "mentalHealthRisk": {...},
        "inputData": {...},
        "recommendations": [...],
        "predictionDate": "2025-11-07T14:30:00Z",
        "createdAt": "2025-11-07T14:30:00Z",
        "updatedAt": "2025-11-07T14:30:00Z"
      }
    ],
    "predictionGenerated": true,
    "predictionUpdatedAt": "2025-11-07T14:30:00Z"
  },
  "prediction": {...}
}
```

### 2. Retrieving Prediction History (`GET /api/inventory/student/{studentId}/prediction`)

**New Query Parameters:**

- `limit` (default: 5, max: 50) - Number of recent predictions to return
- `offset` (default: 0) - Pagination offset

**Response Structure:**

```json
{
  "message": "Mental health prediction retrieved successfully",
  "studentId": "student-id",
  "studentInfo": {
    "studentNumber": "2024-001",
    "program": "Computer Science",
    "name": "John Doe"
  },
  "latestPrediction": {
    "id": "prediction-id",
    "academicPerformanceOutlook": "improved",
    "confidence": 0.85,
    "riskFactors": [...],
    "mentalHealthRisk": {...},
    "predictionDate": "2025-11-07T14:30:00Z"
  },
  "predictionHistory": [
    // Array of past predictions, sorted by predictionDate DESC
    {
      "id": "prediction-id-1",
      "academicPerformanceOutlook": "same",
      "confidence": 0.78,
      "predictionDate": "2025-11-06T10:15:00Z"
    },
    {
      "id": "prediction-id-2",
      "academicPerformanceOutlook": "declined",
      "confidence": 0.72,
      "predictionDate": "2025-11-05T09:00:00Z"
    }
  ],
  "predictionCount": 3,
  "predictionGenerated": true,
  "predictionUpdatedAt": "2025-11-07T14:30:00Z"
}
```

### 3. Retrieving Inventory with Predictions (`GET /api/inventory/student/{studentId}` or `GET /api/inventory/{id}`)

**Field Selection Example:**

```
GET /api/inventory/student/{studentId}?fields=id,height,weight,mentalHealthPredictions.id,mentalHealthPredictions.academicPerformanceOutlook,mentalHealthPredictions.predictionDate
```

This now returns the array of predictions with selected fields instead of a single prediction.

## Migration Considerations

### Data Migration

If you have existing prediction data, run a migration script to convert:

```typescript
// Pseudo code for migration
const inventories = await prisma.individualInventory.findMany({
	where: { predictionGenerated: true },
});

for (const inventory of inventories) {
	if (inventory.mentalHealthPrediction) {
		await prisma.mentalHealthPredictionRecord.create({
			data: {
				inventoryId: inventory.id,
				...inventory.mentalHealthPrediction,
				predictionDate: inventory.predictionUpdatedAt || new Date(),
			},
		});
	}
}
```

### Frontend Updates Required

#### Before (Old Code)

```typescript
const response = await fetch(`/api/inventory/student/${studentId}/prediction`);
const data = await response.json();
const prediction = data.prediction; // Single prediction object
```

#### After (New Code)

```typescript
const response = await fetch(`/api/inventory/student/${studentId}/prediction`);
const data = await response.json();

// Get latest prediction
const latestPrediction = data.latestPrediction;

// Get all predictions for history chart
const allPredictions = data.predictionHistory;

// Show prediction count and history length
console.log(`Total predictions: ${data.predictionCount}`);
```

## Benefits

1. **Historical Tracking** - Monitor changes in mental health risk over time
2. **Trend Analysis** - Identify patterns in student's academic performance and mental health
3. **Better Counseling** - Counselors can see progression/regression patterns
4. **Audit Trail** - Full record of all predictions with timestamps
5. **Data Integrity** - Soft delete preserves historical data
6. **Scalability** - Supports unlimited predictions per student

## API Response Examples

### Single Prediction Request (Most Common)

```bash
curl "http://localhost:3000/api/inventory/student/student-123/prediction"
```

### Get Last 10 Predictions

```bash
curl "http://localhost:3000/api/inventory/student/student-123/prediction?limit=10"
```

### Pagination

```bash
curl "http://localhost:3000/api/inventory/student/student-123/prediction?limit=5&offset=5"
```

## Database Indexes (Performance Optimization)

For better query performance, consider adding indexes:

```prisma
model MentalHealthPredictionRecord {
  // ... existing fields

  @@index([inventoryId])
  @@index([isDeleted])
  @@index([predictionDate])
  @@index([inventoryId, predictionDate]) // Composite index for common queries
}
```

## Backward Compatibility Notes

- `predictionGenerated` and `predictionUpdatedAt` fields still exist on `IndividualInventory` for quick metadata checks
- These fields update automatically when a new prediction is created
- Existing endpoints continue to work; only the data structure changes
- Old single-prediction code will need to be updated to handle arrays

## Error Handling

All error responses remain consistent:

```json
{
	"error": "Mental health prediction not found for this student",
	"message": "This student either doesn't have an inventory or hasn't generated a prediction yet"
}
```

## Testing Recommendations

1. **Test Multiple Predictions** - Create multiple predictions for same student
2. **Test Pagination** - Verify limit and offset work correctly
3. **Test Soft Delete** - Mark prediction as deleted, verify it doesn't appear in results
4. **Test History Ordering** - Verify predictions are ordered by date descending
5. **Test Performance** - Monitor query performance with large history

## Troubleshooting

### Q: Where did my existing predictions go?

**A:** Run the migration script to convert single predictions to the new array format.

### Q: How do I delete a prediction?

**A:** Set `isDeleted = true` on the `MentalHealthPredictionRecord`. This is a soft delete.

### Q: Can I get all predictions without pagination?

**A:** Use `limit=999` (max 50), or adjust the controller's max limit as needed.

### Q: How do I filter predictions by date range?

**A:** Currently, the API returns paginated results. Consider adding a `/prediction/range` endpoint if you need date range filtering.

## Related Files

- **Schema Definition:** `prisma/schema/inventoryRecord.prisma`
- **Controller Logic:** `app/inventory/inventory.controller.ts`
- **API Routes:** `app/inventory/inventory.router.ts`
- **Services:** `capstone-app/src/services/inventory.service.ts` (Frontend)
