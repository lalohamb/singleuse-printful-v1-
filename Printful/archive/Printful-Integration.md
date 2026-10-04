You are a senior TypeScript/Next.js engineer integrating the Printful API into an existing production application.

Your assignment is to build a reusable Printful Product Designer and Mockup Generator module using Printful's official API.

OFFICIAL DOCUMENTATION

Use the current Printful API documentation as the source of truth:

https://developers.printful.com/docs/

Pay particular attention to:

- Catalog API
- Mockup Generator API
- Print files
- Layout templates
- Techniques
- Variant mapping
- Create mockup generation task
- Retrieve mockup generation task
- Mockup styles/options
- Printful Mockup Generator v2 where applicable

Do not invent endpoint names, parameters, response fields, or Printful behavior.

--------------------------------------------------
PHASE 0 — INSPECT THE EXISTING APPLICATION
--------------------------------------------------

Before modifying anything:

1. Inspect package.json.
2. Determine the exact Next.js version.
3. Determine whether the project uses App Router or Pages Router.
4. Determine whether TypeScript is enabled.
5. Inspect src/, app/, components/, lib/, types/, and existing API routes.
6. Identify existing authentication, database, storage, product, Printify, Printful, Stripe, and Supabase integrations.
7. Identify existing environment-variable conventions.
8. Determine whether a product designer or image-upload component already exists.
9. Do not replace or duplicate working infrastructure.
10. Do not upgrade major dependencies unless absolutely necessary.

Produce a short inspection report before implementation.

--------------------------------------------------
OBJECTIVE
--------------------------------------------------

Implement a server-side Printful integration capable of:

1. Retrieving Printful catalog products.
2. Retrieving product variants.
3. Retrieving available print files.
4. Discovering supported printing techniques.
5. Retrieving layout templates for a product.
6. Passing the correct technique when requesting templates.
7. Mapping variants to their applicable templates.
8. Identifying placements such as front, back, sleeve, embroidery locations, etc.
9. Providing print-area geometry to the frontend.
10. Allowing artwork to be positioned inside that print area.
11. Creating an asynchronous Printful mockup-generation task.
12. Persisting the returned task key.
13. Checking task status safely.
14. Returning completed mockups to the application.
15. Providing an architecture that can later persist completed mockups to permanent application storage.

The Printful token MUST remain server-side.

--------------------------------------------------
ARCHITECTURE
--------------------------------------------------

Create a clean Printful integration layer.

Suggested organization:

lib/
  printful/
    client.ts
    catalog.ts
    mockups.ts
    templates.ts
    types.ts
    errors.ts

app/
  api/
    printful/
      products/
      products/[productId]/
      printfiles/[productId]/
      templates/[productId]/
      mockups/
      mockups/[taskKey]/

components/
  product-designer/
    ProductDesigner.tsx
    ProductSelector.tsx
    VariantSelector.tsx
    TechniqueSelector.tsx
    PlacementSelector.tsx
    DesignCanvas.tsx
    MockupPreview.tsx
    MockupStatus.tsx

Adapt this structure to the existing repository rather than blindly creating duplicate directories.

--------------------------------------------------
ENVIRONMENT VARIABLES
--------------------------------------------------

Support:

PRINTFUL_TOKEN=

If an account-level token is being used, optionally support:

PRINTFUL_STORE_ID=

Never expose these through NEXT_PUBLIC_* variables.

Never send the Printful token to client components.

Update .env.example but never place real credentials in source control.

--------------------------------------------------
PRINTFUL CLIENT
--------------------------------------------------

Create a reusable server-only Printful API client.

Base URL:

https://api.printful.com

It should:

- attach Authorization: Bearer <token>
- attach Content-Type when appropriate
- optionally attach X-PF-Store-Id
- parse Printful error responses
- distinguish HTTP errors from Printful API errors
- provide typed results
- handle 401, 404, 429, and 5xx responses
- never log the access token
- provide useful server-side diagnostics

Create a PrintfulApiError class if appropriate.

--------------------------------------------------
CATALOG
--------------------------------------------------

Implement retrieval of Printful products and product details using the current documented Catalog API.

Keep PRODUCT IDs and VARIANT IDs clearly separated.

Never assume that a product ID can be used where Printful requires a variant ID.

Normalize responses into internal TypeScript interfaces when doing so makes the UI safer.

--------------------------------------------------
PRINT FILES
--------------------------------------------------

Retrieve the print-file information for a selected product.

Use Printful's mockup-generator print-file endpoint.

Expose to the frontend the information necessary to determine:

- available placements
- printfile IDs
- variant/printfile mappings
- width
- height
- DPI
- rotation capability
- mockup options
- option groups

Do not hard-code placement availability.

--------------------------------------------------
TECHNIQUES
--------------------------------------------------

Support Printful techniques documented for the Mockup Generator API.

Examples may include:

DIGITAL
CUT-SEW
UV
EMBROIDERY
SUBLIMATION
ENGRAVING
DTG

Do not assume every technique is available for every product.

Determine applicable techniques from Printful data whenever possible.

--------------------------------------------------
LAYOUT TEMPLATE ENDPOINT
--------------------------------------------------

Implement:

GET /mockup-generator/templates/{productId}

Support query parameters including:

technique
orientation

The API route should accept requests such as:

/api/printful/templates/71?technique=DTG

and translate them into the corresponding Printful request.

Do not hard-code DTG into the product designer.

If the user chooses embroidery, sublimation, or another supported technique, retrieve the corresponding layout information.

--------------------------------------------------
LAYOUT TEMPLATE DATA
--------------------------------------------------

Model the relevant template response including:

version
min_dpi
variant_mapping
templates
conflicting_placements

For each template preserve fields including:

template_id
image_url
background_url
background_color
printfile_id
template_width
template_height
print_area_width
print_area_height
print_area_top
print_area_left
is_template_on_front
orientation

Use variant_mapping to determine which template applies to the selected variant and placement.

--------------------------------------------------
PRODUCT DESIGNER
--------------------------------------------------

Build a ProductDesigner component.

The basic flow should be:

Select product
        ↓
Select variant
        ↓
Select technique
        ↓
Retrieve layout templates
        ↓
Determine valid placements
        ↓
Select placement
        ↓
Upload/select artwork
        ↓
Position artwork
        ↓
Generate mockup
        ↓
Display completed mockup

The frontend must use Printful's returned template geometry rather than arbitrary fixed coordinates.

--------------------------------------------------
DESIGN CANVAS
--------------------------------------------------

Create a responsive design canvas.

Display:

- Printful template image when applicable
- printable-area boundary
- customer artwork
- controls for moving artwork
- controls for resizing artwork

Maintain the artwork's aspect ratio by default.

Prevent invalid zero or negative dimensions.

Keep artwork coordinates constrained appropriately.

The UI coordinates must ultimately be converted into the coordinate system required by Printful.

Create explicit utility functions for coordinate conversion rather than scattering coordinate calculations throughout React components.

For example:

canvasToPrintfulCoordinates()
printfulToCanvasCoordinates()

These functions should be independently testable.

--------------------------------------------------
ARTWORK
--------------------------------------------------

The mockup-generation endpoint requires Printful to be able to retrieve the artwork.

Do not send local browser blob URLs to Printful.

Create an abstraction where artwork ultimately has a publicly reachable URL.

If the application already uses Supabase Storage or another storage provider, reuse it.

Otherwise create an interface such as:

interface ArtworkStorage {
  upload(file: File): Promise<{
    url: string;
    width?: number;
    height?: number;
  }>;
}

Do not introduce a new storage vendor without justification.

Validate:

- file type
- file size
- URL
- image dimensions when available

Respect Printful's documented image limitations.

--------------------------------------------------
CREATE MOCKUP TASK
--------------------------------------------------

Implement the Printful endpoint:

POST /mockup-generator/create-task/{productId}

Create an internal route such as:

POST /api/printful/mockups

Request model:

{
  productId,
  variantIds,
  format,
  width,
  technique,
  files,
  options,
  optionGroups
}

The server must validate the request before forwarding it to Printful.

Build the Printful request using the selected variants and artwork.

A file should support:

placement
image_url
position

Position should support:

area_width
area_height
width
height
top
left

Use Printful layout-template data to derive these values.

Do not hard-code the print area.

--------------------------------------------------
ASYNC TASK HANDLING
--------------------------------------------------

Printful mockup generation is asynchronous.

When create-task succeeds, capture:

task_key
status

Do NOT pretend the mockup exists immediately.

Implement:

GET /api/printful/mockups/[taskKey]

which retrieves:

GET /mockup-generator/task?task_key={taskKey}

Support:

pending
completed
failed

The frontend should:

1. submit generation request
2. receive task key
3. show generating state
4. wait before first status request
5. poll conservatively
6. stop polling when completed
7. stop polling when failed
8. stop after a reasonable timeout
9. clean up timers when the component unmounts

Do not aggressively poll Printful.

Respect Printful rate limits and Retry-After headers where supplied.

--------------------------------------------------
COMPLETED MOCKUPS
--------------------------------------------------

When generation completes, display:

- primary mockup
- placement
- associated variants
- additional mockups where supplied
- option
- option group

Do not assume Printful mockup URLs are permanent.

Create a clearly documented persistence boundary such as:

persistGeneratedMockup()

The architecture should allow completed mockups to later be downloaded server-side and stored in the application's permanent object storage.

Do not automatically add a new storage service if one already exists.

--------------------------------------------------
OPTIONS AND MOCKUP STYLES
--------------------------------------------------

Expose Printful options and option_groups where supported.

Allow the application to eventually select mockup presentations such as:

Front
Back
Flat
Lifestyle
Men's
Women's

Do not hard-code these names as universally available.

Retrieve available values from Printful for the selected product.

Avoid sending incompatible combinations that unnecessarily produce Printful errors.

--------------------------------------------------
CONFLICTING PLACEMENTS
--------------------------------------------------

Use conflicting_placements from Printful layout-template responses.

If Printful reports that two placements conflict, prevent or warn against the invalid combination before submitting the generation task.

Do not silently submit a known invalid combination.

--------------------------------------------------
RATE LIMITING
--------------------------------------------------

Printful imposes rate limits on mockup generation.

Implement protection against:

- repeated Generate button clicks
- accidental duplicate requests
- excessive polling

Disable the Generate button while a task is active.

Return useful UI messages for HTTP 429.

Where appropriate, inspect Printful rate-limit headers and Retry-After.

--------------------------------------------------
SECURITY
--------------------------------------------------

Mandatory:

- Printful token server-side only
- no NEXT_PUBLIC_PRINTFUL_TOKEN
- no token in browser network responses
- validate product IDs
- validate variant IDs
- validate technique
- validate placement
- validate artwork URLs
- validate dimensions
- sanitize API errors before sending them to clients
- do not expose internal stack traces
- do not log secrets

If the application has authentication, protect product-design mutation routes appropriately.

--------------------------------------------------
TYPE SAFETY
--------------------------------------------------

Do not use `any` unless there is a documented unavoidable reason.

Create TypeScript interfaces for:

PrintfulApiResponse<T>
PrintfulProduct
PrintfulVariant
PrintfulPrintfile
PrintfulVariantPrintfile
PrintfulLayoutTemplate
PrintfulVariantMapping
PrintfulPosition
PrintfulGenerationFile
PrintfulMockupTask
PrintfulGeneratedMockup

Match the current Printful documentation rather than guessing fields.

--------------------------------------------------
ERROR HANDLING
--------------------------------------------------

Provide user-friendly handling for:

401
invalid token

404
invalid product/task

400
invalid variants/options/placement

429
Printful rate limit

5xx
Printful service failure

task status = failed

network timeout

invalid artwork URL

No generic "Something went wrong" message should be the only diagnostic available.

Keep detailed diagnostics server-side and return safe messages to the browser.

--------------------------------------------------
V1 VS V2
--------------------------------------------------

Printful currently documents both the established Mockup Generator API and newer Mockup Generator v2 capabilities.

For the first implementation:

Use the stable API necessary to reproduce the documented layout-template workflow.

Do NOT mix incompatible v1 and v2 request schemas.

However, isolate Printful-specific behavior behind the Printful service layer so the mockup engine can later migrate to Mockup Generator v2 without rewriting the ProductDesigner UI.

Document where v2 could replace the current implementation.

--------------------------------------------------
TESTS
--------------------------------------------------

Add tests for at minimum:

1. Printful authorization header construction.
2. Product ID validation.
3. Variant ID validation.
4. Template response parsing.
5. Variant-to-template mapping.
6. technique query construction.
7. artwork coordinate conversion.
8. create-task payload construction.
9. pending task handling.
10. completed task handling.
11. failed task handling.
12. rate-limit response handling.
13. conflicting placements.
14. malformed Printful response.

Mock external Printful API calls in automated tests.

Do not create live Printful mockups during ordinary automated tests.

--------------------------------------------------
MANUAL TEST
--------------------------------------------------

After implementation, provide a manual verification procedure.

Example:

1. Add PRINTFUL_TOKEN.
2. Start development server.
3. Open Product Designer.
4. Select a Printful catalog product.
5. Select variant.
6. select technique.
7. verify template changes appropriately.
8. upload artwork.
9. move/resize artwork.
10. generate mockup.
11. confirm task key is returned.
12. confirm UI enters pending state.
13. confirm polling begins after an appropriate delay.
14. confirm completed mockup appears.
15. confirm no Printful credential appears in browser DevTools.

--------------------------------------------------
BUILD VERIFICATION
--------------------------------------------------

Run the repository's existing validation commands.

At minimum, where available:

npm run typecheck
npm run lint
npm run test
npm run build

Fix errors caused by this implementation.

Do not suppress TypeScript or ESLint errors merely to make the build pass.

--------------------------------------------------
DELIVERABLE
--------------------------------------------------

When finished, provide an implementation report containing:

PRINTFUL INTEGRATION REPORT

Repository inspection:
- framework/version
- routing architecture
- relevant existing infrastructure

Implemented:
- Printful client
- catalog retrieval
- printfile retrieval
- technique support
- layout templates
- variant/template mapping
- product designer
- coordinate conversion
- artwork handling
- mockup generation
- task polling
- mockup display
- error handling
- rate-limit handling

Files created:
...

Files modified:
...

Environment variables:
...

API routes:
...

Tests:
PASS / FAIL

Typecheck:
PASS / FAIL

Lint:
PASS / FAIL

Build:
PASS / FAIL

Security verification:
- token server-side: PASS / FAIL
- token absent from client bundle: PASS / FAIL
- input validation: PASS / FAIL

Remaining work:
...
Do not report PASS unless the command or behavior was actually verified.