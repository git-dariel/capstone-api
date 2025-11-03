# Word Template Dynamic Table Loops Guide

This guide explains how to modify your Word template to support dynamic table rows for Assessment History and Consultation Details.

## Overview

The updated mental health assessment export API now provides data in arrays that can be used to create dynamic table rows. This means:

- **Assessment History**: All assessments (Anxiety, Depression, Stress, Suicide, Checklist) will each create a separate row
- **Consultation Details**: All consultation notes will each create a separate row

## Template Syntax

### Assessment History Table

Replace your current static Assessment History table with this dynamic structure:

```
| Assessment Name | Score | Severity Level | Date |
|-----------------|-------|----------------|------|
| {#assessments}{assessment_name} | {score} | {severity_level} | {date}{/assessments} |
```

**Key Points:**

- `{#assessments}` starts the loop and should be placed in the SAME cell as the first field
- `{/assessments}` ends the loop and should be placed in the SAME cell as the last field
- Each field (`{assessment_name}`, `{score}`, `{severity_level}`, `{date}`) will be populated for each assessment
- If a student has 5 assessments, this will create 5 rows
- **IMPORTANT**: Do not put the loop tags in separate rows - this creates blank rows!

### Consultation Details Table

Replace your current static Consultation Details table with this dynamic structure:

```
| Note Title | Description | Date |
|------------|-------------|------|
| {#consultations}{note_title} | {note_description} | {note_date}{/consultations} |
```

**Key Points:**

- `{#consultations}` starts the loop and should be placed in the SAME cell as the first field
- `{/consultations}` ends the loop and should be placed in the SAME cell as the last field
- Each field (`{note_title}`, `{note_description}`, `{note_date}`) will be populated for each consultation note
- If a student has 3 consultation notes, this will create 3 rows
- **IMPORTANT**: Do not put the loop tags in separate rows - this creates blank rows!

## Implementation Steps

### Step 1: Open Template.docx

1. Open your existing `Template.docx` file in Microsoft Word
2. Navigate to the Assessment History section
3. Navigate to the Consultation Details section

### Step 2: Update Assessment History Table

1. Find your Assessment History table
2. Delete the existing static rows (except the header)
3. Add ONE new row with the combined loop syntax:
    - Cell 1: `{#assessments}{assessment_name}`
    - Cell 2: `{score}`
    - Cell 3: `{severity_level}`
    - Cell 4: `{date}{/assessments}`

**Important**: Put the opening loop tag `{#assessments}` in the same cell as the first field, and the closing tag `{/assessments}` in the same cell as the last field.

### Step 3: Update Consultation Details Table

1. Find your Consultation Details table
2. Delete the existing static rows (except the header)
3. Add ONE new row with the combined loop syntax:
    - Cell 1: `{#consultations}{note_title}`
    - Cell 2: `{note_description}`
    - Cell 3: `{note_date}{/consultations}`

**Important**: Put the opening loop tag `{#consultations}` in the same cell as the first field, and the closing tag `{/consultations}` in the same cell as the last field.

### Step 4: Save the Template

1. Save the updated `Template.docx` file
2. Ensure it's saved in the correct location: `capstone-api/config/data/Template.docx`

## Alternative: Simple Text Format

If you prefer a simpler approach without tables, you can also use these text-based loops:

### Assessment History (Text Format)

```
Assessment History:
{#assessments}
- {assessment_name}: {score} ({severity_level}) - {date}
{/assessments}
```

### Consultation Details (Text Format)

```
Consultation Details:
{#consultations}
- {note_title} ({note_date}): {note_description}
{/consultations}
```

## Data Structure Examples

### Assessment History Data

```typescript
assessments: [
	{
		assessment_name: "Anxiety (GAD-7)",
		score: "15",
		severity_level: "Moderate",
		date: "November 3, 2025",
	},
	{
		assessment_name: "Depression (PHQ-9)",
		score: "12",
		severity_level: "Mild",
		date: "November 2, 2025",
	},
];
```

### Consultation Details Data

```typescript
consultations: [
	{
		note_title: "Initial Assessment",
		note_description: "Student shows some risk factors that warrant attention...",
		note_date: "November 1, 2025",
	},
	{
		note_title: "Follow-up Session",
		note_description: "Student has shown improvement in stress management...",
		note_date: "November 3, 2025",
	},
];
```

## Backward Compatibility

The API still provides the legacy single-record fields for backward compatibility:

- `assessment_name`, `score`, `severity_level`, `date` (most recent assessment)
- `note_name`, `description_consultation` (all consultations as combined text)
- `assessment_history` (all assessments as combined text)

This means your existing template will continue to work, but you'll only see the most recent assessment and combined consultation text.

## Testing

After updating your template:

1. Generate a mental health assessment report for a student with multiple assessments
2. Verify that each assessment creates a separate table row
3. Generate a report for a student with multiple consultation notes
4. Verify that each consultation creates a separate table row
5. Check the server logs for debugging information about the data structure

## Troubleshooting

### Common Issues:

1. **No rows appearing**: Check that the loop syntax is correct and placed in table cells
2. **Loop syntax appearing in output**: Ensure you're using curly braces `{}` not parentheses or other brackets
3. **Missing data**: Check the server logs for debugging information about data availability
4. **Blank rows appearing**: This happens when loop tags are in separate rows. Make sure to put `{#arrayName}` in the same cell as the first field and `{/arrayName}` in the same cell as the last field
5. **Table formatting issues**: Ensure you're using only ONE row for the loop, not three separate rows

### Fixing Blank Rows Issue

If you see blank rows in your table (like in your second image), you need to:

1. **Delete the three-row structure** you currently have
2. **Create only ONE row** with this exact structure:
    - For Assessment History: `{#assessments}{assessment_name} | {score} | {severity_level} | {date}{/assessments}`
    - For Consultation Details: `{#consultations}{note_title} | {note_description} | {note_date}{/consultations}`

**Example of WRONG structure (creates blank rows):**

```
Row 1: {#assessments} | | |
Row 2: {assessment_name} | {score} | {severity_level} | {date}
Row 3: {/assessments} | | |
```

**Example of CORRECT structure (no blank rows):**

```
Row 1: {#assessments}{assessment_name} | {score} | {severity_level} | {date}{/assessments}
```

### Debug Information

The API now logs detailed information about:

- Number of assessments found
- Number of consultations found
- Sample data structures
- Any missing data

Check the server console for these logs when testing.

## Need Help?

If you encounter issues:

1. Check the server logs for debugging information
2. Verify the template syntax matches exactly as shown in this guide
3. Test with a student who has multiple assessments and consultation notes
4. Ensure the Template.docx file is saved and accessible

The dynamic table feature makes your mental health assessment reports much more comprehensive by showing the complete history rather than just the latest information.
