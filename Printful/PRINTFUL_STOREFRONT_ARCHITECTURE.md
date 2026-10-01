# Printful Storefront Architecture

## Purpose of This Document

This document defines the intended architecture for integrating
**Printful** with the storefront.

Its purpose is to prevent the storefront from becoming tightly coupled
to a print-on-demand provider and to clearly separate:

1.  the products the storefront chooses to sell;
2.  the products and variants Printful is capable of manufacturing;
3.  the artwork and designs owned by the storefront;
4.  dynamically generated product mockups;
5.  customer-facing product data;
6.  checkout and payment processing; and
7.  Printful order fulfillment.

The central architectural principle is:

> **The storefront owns the commercial product catalog. Printful
> provides manufacturing capabilities, production data, mockup
> generation, and fulfillment services.**

This distinction is important because a storefront product is not
necessarily the same thing as a Printful product.

A customer might see a product called **Will County Classic T-Shirt ---
\$27.99**. Internally, that product may use a particular Printful blank
garment, several Printful variants, storefront-owned artwork, storefront
pricing, and one or more Printful-generated mockups.

Printful is therefore a production provider behind the storefront rather
than the owner of the storefront's business model.

------------------------------------------------------------------------

# 1. Executive Overview

The architecture should ultimately operate like this:

``` text
                         STOREFRONT
                             |
              +--------------+--------------+
              |                             |
       Product Catalog                Product Designer
              |                             |
              +--------------+--------------+
                             |
                    Printful Service Layer
                             |
          +------------------+------------------+
          |                  |                  |
       Catalog            Mockups             Orders
          |                  |                  |
          +------------------+------------------+
                             |
                          PRINTFUL
```

The storefront should maintain its own catalog and database.

Printful should provide the storefront with information about:

-   blank products;
-   product variants;
-   colors;
-   sizes;
-   manufacturing availability;
-   printing techniques;
-   printable areas;
-   placements;
-   layout templates;
-   mockup generation;
-   production orders;
-   fulfillment;
-   shipping; and
-   tracking.

The storefront then decides which of those capabilities become actual
products offered to customers.

------------------------------------------------------------------------

# 2. Why This Architecture Is Needed

A print-on-demand provider naturally organizes information around
manufacturing.

A storefront organizes information around selling.

Those are related responsibilities, but they are not identical.

Printful may describe a product as:

``` text
Catalog Product
    |
    +-- Variant 1
    +-- Variant 2
    +-- Variant 3
    +-- Variant 4
```

The storefront needs additional business information:

``` text
Storefront Product
    |
    +-- Name
    +-- Description
    +-- Category
    +-- Collection
    +-- Retail Price
    +-- SEO Information
    +-- Artwork
    +-- Mockups
    +-- Featured Status
    +-- Publication Status
    +-- Product Variants
    +-- Provider Mapping
```

Printful does not need to control all of those decisions.

The storefront does.

------------------------------------------------------------------------

# 3. The Three Catalog Concepts

One of the most important distinctions in this architecture is that
there can be multiple types of "products."

## 3.1 Printful Catalog

The Printful catalog represents products that Printful is capable of
manufacturing.

Examples include:

``` text
Printful Catalog
|
+-- T-Shirts
|   +-- Bella + Canvas products
|   +-- Gildan products
|   +-- Comfort Colors products
|
+-- Hoodies
|
+-- Sweatshirts
|
+-- Hats
|
+-- Mugs
|
+-- Posters
|
+-- Bags
|
+-- Accessories
|
+-- Other printable merchandise
```

These are primarily **manufacturing products**.

They should not automatically become products on the public storefront.

------------------------------------------------------------------------

## 3.2 Storefront Catalog

The storefront catalog represents products the business has deliberately
chosen to sell.

For example:

``` text
Storefront Catalog
|
+-- For Him
|   +-- County Classic Tee
|   +-- Heritage Hoodie
|
+-- For Her
|   +-- County Pride Tee
|   +-- Local Roots Sweatshirt
|
+-- For Home
|   +-- County Coffee Mug
|   +-- Local Heritage Poster
|
+-- Gifts
    +-- Personalized Mug
    +-- County Tote
```

The storefront controls:

-   product name;
-   product description;
-   category;
-   collections;
-   pricing;
-   promotions;
-   SEO;
-   publication;
-   featured products;
-   artwork;
-   mockup selection;
-   merchandising; and
-   customer presentation.

------------------------------------------------------------------------

## 3.3 Designs

Designs should be treated as independent business assets.

For example:

``` text
Design Library
|
+-- Will County Classic
+-- Cook County Heritage
+-- Home Is Where the County Is
+-- Born & Raised
+-- Local Roots
+-- Custom Family Name
```

A design can potentially be applied to multiple products.

This is considerably more scalable than permanently binding one design
to one Printful product.

For example:

``` text
                    WILL COUNTY DESIGN
                           |
             +-------------+-------------+
             |             |             |
          T-Shirt        Hoodie          Mug
             |             |             |
             +-------------+-------------+
                           |
                       Storefront
```

------------------------------------------------------------------------

# 4. The Core Architectural Principle

The application should avoid this model:

``` text
PRINTFUL PRODUCT
      |
      v
STOREFRONT PRODUCT
```

where the storefront is merely a mirror of Printful.

Instead, the preferred architecture is:

``` text
                         STOREFRONT PRODUCT
                                |
              +-----------------+-----------------+
              |                                   |
           DESIGN                           PROVIDER MAPPING
              |                                   |
        Artwork/Brand                         PRINTFUL
                                                  |
                                         Catalog Product
                                                  |
                                              Variants
```

This allows the storefront product to exist independently of Printful's
internal product representation.

------------------------------------------------------------------------

# 5. Why Printful Should Not Be the Storefront Source of Truth

If Printful becomes the source of truth for the storefront, several
long-term limitations can appear.

## 5.1 Provider Lock-In

Business logic can become dependent on Printful-specific IDs and
response structures.

For example, code throughout the application might directly reference:

``` text
printful_product_id
printful_variant_id
```

That makes another provider difficult to introduce later.

A better model is:

``` text
product.id
variant.id

provider = PRINTFUL
provider_product_id = ...
provider_variant_id = ...
```

The storefront retains its own identifiers.

------------------------------------------------------------------------

## 5.2 Merchandising Limitations

The way Printful organizes manufacturing products may not match how
customers should browse the storefront.

The storefront may want categories such as:

``` text
For Him
For Her
For Home
Culture
Funny
Personalized
Trending
Gifts
Local Favorites
New Arrivals
Under $25
```

Those are business and merchandising concepts.

They should not depend on Printful's catalog taxonomy.

------------------------------------------------------------------------

## 5.3 Pricing Control

Printful primarily provides manufacturing costs.

The storefront determines retail pricing.

Conceptually:

``` text
Printful Production Cost
          +
Business Margin
          +
Other Costs
          =
Storefront Retail Price
```

Retail pricing therefore belongs to the storefront.

------------------------------------------------------------------------

## 5.4 SEO Control

Storefront URLs and metadata should belong to the business.

For example:

``` text
/products/will-county-classic-shirt
```

rather than being defined by Printful identifiers.

The storefront should own:

-   slug;
-   title;
-   description;
-   metadata;
-   structured data;
-   canonical URL;
-   product copy; and
-   indexing strategy.

------------------------------------------------------------------------

# 6. Why the Mockup Generator Work Is Still Valuable

The initial Printful implementation goes beyond simple product
synchronization.

That is intentional and remains valuable.

A basic integration could simply synchronize completed Printful
products.

The Mockup Generator architecture adds another capability:

> The storefront can dynamically combine a Printful manufacturing
> product with storefront-owned artwork and ask Printful to create
> realistic product images.

Conceptually:

``` text
Printful Blank Product
          +
Storefront Artwork
          +
Variant
          +
Placement
          +
Printing Technique
          |
          v
Printful Mockup Generator
          |
          v
Generated Product Mockup
```

This capability can later support:

-   automatic product creation;
-   personalized products;
-   localized merchandise;
-   county-specific products;
-   dynamic designs;
-   customer customization;
-   automated product previews;
-   administrative product builders; and
-   large catalogs without manually creating every possible product
    combination.

------------------------------------------------------------------------

# 7. Layout Templates

The Printful layout-template capability tells the storefront where
artwork can safely be printed.

A simplified shirt might look like:

``` text
+--------------------------------+
|                                |
|             SHIRT              |
|                                |
|       +----------------+       |
|       |                |       |
|       |   PRINT AREA   |       |
|       |                |       |
|       +----------------+       |
|                                |
+--------------------------------+
```

Printful provides geometry describing this printable region.

That may include values representing:

``` text
template width
template height
print area width
print area height
print area top
print area left
```

The application can use these measurements to correctly position
artwork.

This becomes particularly important when the storefront generates
products dynamically.

------------------------------------------------------------------------

# 8. Why Variants Matter

A Printful catalog product can have many variants.

For example:

``` text
Premium T-Shirt
|
+-- Black / Small
+-- Black / Medium
+-- Black / Large
+-- Black / XL
+-- Navy / Small
+-- Navy / Medium
+-- Navy / Large
+-- White / Small
+-- White / Medium
+-- White / Large
```

A storefront should distinguish between:

``` text
PRODUCT
```

and:

``` text
VARIANT
```

The product represents the commercial item.

The variant represents a specific purchasable configuration.

This distinction is essential for:

-   inventory/availability;
-   color selection;
-   size selection;
-   SKU management;
-   pricing;
-   fulfillment;
-   order submission; and
-   Printful mapping.

------------------------------------------------------------------------

# 9. Recommended Data Ownership

The following model describes which system should own which information.

  Information                  Primary Owner
  ---------------------------- --------------------------------------
  Product name                 Storefront
  Product description          Storefront
  Retail price                 Storefront
  Categories                   Storefront
  Collections                  Storefront
  SEO                          Storefront
  Artwork                      Storefront
  Product publication status   Storefront
  Featured status              Storefront
  Base manufacturing product   Printful
  Manufacturing variants       Printful
  Production availability      Printful
  Print placements             Printful
  Print techniques             Printful
  Print-area geometry          Printful
  Production cost              Printful
  Mockup generation            Printful
  Manufacturing                Printful
  Fulfillment                  Printful
  Shipping/tracking source     Printful
  Customer/order record        Storefront
  Payment transaction          Payment provider / Storefront record

This separation creates clear system boundaries.

------------------------------------------------------------------------

# 10. Suggested Storefront Data Model

The exact schema should be determined from the existing application
before migrations are written.

Conceptually, however, the architecture should resemble the following.

## Products

``` text
products
--------------------------------
id
name
slug
description
category_id
status
retail_price
featured
seo_title
seo_description
created_at
updated_at
```

This is the storefront's commercial product.

------------------------------------------------------------------------

## Provider Product Mapping

``` text
product_providers
--------------------------------
id
product_id
provider
provider_product_id
created_at
updated_at
```

Example:

``` text
provider = PRINTFUL
provider_product_id = 71
```

This prevents the storefront product ID from becoming a Printful ID.

------------------------------------------------------------------------

## Variants

``` text
variants
--------------------------------
id
product_id
sku
color
size
retail_price
active
created_at
updated_at
```

------------------------------------------------------------------------

## Provider Variant Mapping

``` text
variant_providers
--------------------------------
id
variant_id
provider
provider_variant_id
provider_cost
available
last_synced_at
```

------------------------------------------------------------------------

## Designs

``` text
designs
--------------------------------
id
name
slug
artwork_url
status
metadata
created_at
updated_at
```

------------------------------------------------------------------------

## Product Designs

``` text
product_designs
--------------------------------
id
product_id
design_id
placement
technique
configuration
created_at
updated_at
```

This allows one design to be used on multiple products.

------------------------------------------------------------------------

## Mockups

``` text
product_mockups
--------------------------------
id
product_id
variant_id
design_id
provider
provider_task_id
source_url
stored_url
placement
status
created_at
updated_at
```

This creates a boundary between temporary provider-generated images and
permanently stored storefront assets.

------------------------------------------------------------------------

# 11. Provider Abstraction

Even if Printful is initially the only provider, provider-specific code
should remain isolated.

Preferred:

``` text
lib/
|
+-- providers/
    |
    +-- printful/
        +-- client
        +-- catalog
        +-- templates
        +-- mockups
        +-- orders
        +-- types
```

or an equivalent structure appropriate to the existing repository.

Business components should avoid making raw Printful API calls directly.

Instead:

``` text
Storefront
    |
    v
Provider Service
    |
    v
Printful Adapter
    |
    v
Printful API
```

This creates an abstraction boundary.

------------------------------------------------------------------------

# 12. Future Multi-Provider Architecture

The long-term architecture could support multiple POD providers.

``` text
                      STOREFRONT
                          |
                    PRODUCT CATALOG
                          |
                  PROVIDER ABSTRACTION
                          |
             +------------+------------+
             |                         |
          PRINTFUL                   PRINTIFY
             |                         |
      Manufacturing A          Manufacturing B
```

The customer should not need to know which provider fulfills the product
unless the business chooses to disclose it.

This architecture could eventually allow the business to choose a
provider based on:

-   product availability;
-   manufacturing cost;
-   shipping destination;
-   quality;
-   production time;
-   product type; or
-   business preference.

Multi-provider routing is a future capability, not an immediate
requirement.

------------------------------------------------------------------------

# 13. Phased Implementation Strategy

The project should be developed incrementally.

## Phase 1 --- Printful Integration Foundation

Purpose:

Create a reliable communication layer between the storefront and
Printful.

Capabilities include:

-   authenticated Printful API client;
-   catalog access;
-   product retrieval;
-   variant retrieval;
-   print-file information;
-   printing techniques;
-   layout templates;
-   variant/template mapping;
-   mockup generation;
-   asynchronous task handling;
-   rate-limit handling;
-   secure token management; and
-   error handling.

This is the foundation currently being built.

### Why Phase 1 matters

Although it initially appears larger than a simple synchronization
feature, it establishes reusable infrastructure for later automation.

It should not be discarded merely because the first storefront release
may use only part of it.

------------------------------------------------------------------------

# 14. Phase 2 --- Storefront Product Catalog

Purpose:

Make the storefront database the commercial source of truth.

Architecture:

``` text
Printful Catalog
       |
       v
Admin Catalog Browser
       |
       v
Select Products to Offer
       |
       v
Storefront Product Database
       |
       v
Categories / Collections / Pricing
       |
       v
Public Storefront
```

The business should be able to browse available Printful products and
choose which ones become storefront products.

This phase should introduce or stabilize:

-   storefront products;
-   categories;
-   collections;
-   variants;
-   provider mappings;
-   pricing;
-   product status;
-   product publication;
-   SEO fields; and
-   catalog administration.

The system should **not automatically publish the entire Printful
catalog**.

------------------------------------------------------------------------

# 15. Phase 3 --- Design Library and Dynamic Mockups

Purpose:

Separate artwork from manufacturing products and allow them to be
combined programmatically.

Architecture:

``` text
              DESIGN LIBRARY
                    |
                    +
          PRINTFUL BASE PRODUCT
                    |
                    +
                  VARIANT
                    |
                    +
                 PLACEMENT
                    |
                    v
          MOCKUP GENERATOR API
                    |
                    v
             PRODUCT MOCKUP
                    |
                    v
             STOREFRONT PRODUCT
```

This is where the Mockup Generator becomes especially valuable.

------------------------------------------------------------------------

# 16. Phase 4 --- Order Fulfillment

Purpose:

Convert paid storefront orders into Printful fulfillment orders.

``` text
Customer
    |
    v
Storefront Cart
    |
    v
Checkout
    |
    v
Payment
    |
    v
Storefront Order
    |
    v
Printful Fulfillment Order
    |
    v
Production
    |
    v
Shipping
    |
    v
Tracking
```

The storefront should retain its own order record even after an order is
submitted to Printful.

Provider order IDs should be mappings, not replacements for internal
order IDs.

------------------------------------------------------------------------

# 17. Phase 5 --- Administrative Product Builder

Once catalog, designs, variants, and mockup generation are stable, the
business can create products through an internal administrative
workflow.

Example:

``` text
CREATE PRODUCT

Base Product:
[ Premium T-Shirt            v ]

Design:
[ Will County Classic        v ]

Colors:
[x] Black
[x] Navy
[x] White

Sizes:
[x] S
[x] M
[x] L
[x] XL
[x] 2XL

Placement:
[ Front                      v ]

Technique:
[ DTG                        v ]

Retail Price:
[ $27.99                       ]

       [ GENERATE MOCKUPS ]

       [ SAVE DRAFT ]

       [ PUBLISH ]
```

This can significantly reduce manual product creation.

------------------------------------------------------------------------

# 18. Phase 6 --- Customer Personalization

This phase is optional.

It should only be built if the business needs customers to customize
products themselves.

Potential capabilities include:

-   upload artwork;
-   enter personalized text;
-   choose county/location;
-   choose names;
-   reposition artwork;
-   resize artwork;
-   select placement;
-   preview product;
-   generate mockup; and
-   purchase the resulting configuration.

Conceptually:

``` text
Customer
   |
   +-- Select Product
   |
   +-- Select Variant
   |
   +-- Add Design/Text
   |
   +-- Position Artwork
   |
   +-- Generate Preview
   |
   +-- Add to Cart
   |
   +-- Purchase
```

This is considerably more complex than catalog synchronization and
should not block the initial storefront.

------------------------------------------------------------------------

# 19. Dynamic Catalog Scalability

One of the largest benefits of this architecture is avoiding unnecessary
product duplication.

Consider:

``` text
3,000 locations
x
10 designs
x
5 garment choices
```

A naive implementation could require:

``` text
150,000 product combinations
```

Creating every combination manually in a POD provider would be difficult
to administer.

A dynamic system can instead store reusable building blocks:

``` text
LOCATIONS
+
DESIGNS
+
BASE PRODUCTS
+
VARIANTS
+
MOCKUP RULES
```

and combine them as needed.

For example:

``` text
Location: Will County
Design: Local Roots
Product: Premium Tee
Color: Black

                 |
                 v

        Generated Configuration

                 |
                 v

          Generated Mockup
```

This can substantially reduce catalog-management overhead.

------------------------------------------------------------------------

# 20. Benefits of the Architecture

## 20.1 Business Independence

The storefront owns its commercial data.

A POD provider can be changed without redefining the entire storefront.

------------------------------------------------------------------------

## 20.2 Scalability

Reusable designs and base products can generate many sellable
combinations.

------------------------------------------------------------------------

## 20.3 Cleaner Database Design

Internal IDs remain separate from provider IDs.

This avoids spreading provider-specific assumptions throughout the
application.

------------------------------------------------------------------------

## 20.4 Better Administration

The business can eventually manage products through its own
administrative interface rather than constantly switching between the
storefront and Printful.

------------------------------------------------------------------------

## 20.5 Dynamic Product Creation

Mockups can be generated programmatically instead of manually creating
every product image.

------------------------------------------------------------------------

## 20.6 Personalization

The same infrastructure can later support customer-customized products.

------------------------------------------------------------------------

## 20.7 Multi-Provider Readiness

A future Printify or other POD provider integration can be implemented
behind the same storefront catalog.

------------------------------------------------------------------------

## 20.8 Better SEO

The storefront owns URLs, product descriptions, categories, metadata,
and content strategy.

------------------------------------------------------------------------

## 20.9 Better Pricing Control

Retail prices remain independent from Printful production costs.

------------------------------------------------------------------------

## 20.10 Better Customer Experience

Customers interact with one cohesive storefront rather than being
exposed to the operational structure of the fulfillment provider.

------------------------------------------------------------------------

# 21. Why Not Restart the Current Implementation

The existing Printful implementation should not be discarded simply
because it includes mockup-generation capabilities beyond basic
synchronization.

The work can become the Printful service layer.

For example:

``` text
CURRENT WORK
|
+-- Printful API client
+-- Catalog communication
+-- Variant handling
+-- Print files
+-- Techniques
+-- Layout templates
+-- Mockup generation
+-- Async tasks
+-- Error handling
+-- Security
```

The next catalog phase can sit above it:

``` text
                   NEW CATALOG LAYER
                           |
                           v
                 CURRENT PRINTFUL LAYER
                           |
                           v
                        PRINTFUL
```

The investment therefore remains useful.

The important next step is to ensure that old Printify assumptions do
not dictate the new architecture.

------------------------------------------------------------------------

# 22. Lessons From the Previous Printify-Based Structure

Reusing existing code can accelerate development, but provider-specific
code can also carry hidden assumptions.

Examples to watch for include:

``` text
printifyProductId
printifyVariantId
Printify-specific product types
Printify-specific API response structures
Printify-specific synchronization logic
Printify-specific checkout assumptions
```

These should not simply be renamed to Printful equivalents if the
underlying architecture remains provider-specific.

Instead, the preferred pattern is:

``` text
Internal Product
      |
      v
Provider Mapping
      |
      +-- provider = PRINTFUL
      +-- provider_product_id = ...
```

This provides a clean separation.

------------------------------------------------------------------------

# 23. Migration Principle

The project does not need to be rewritten from scratch solely because
some code originated from a Printify implementation.

The correct approach is:

``` text
INSPECT
   |
   v
IDENTIFY PROVIDER-SPECIFIC ASSUMPTIONS
   |
   v
PRESERVE GOOD GENERIC CODE
   |
   v
ISOLATE PRINTFUL CODE
   |
   v
REMOVE OBSOLETE PRINTIFY DEPENDENCIES
   |
   v
BUILD PROVIDER-NEUTRAL CATALOG
```

Good reusable components should remain.

Only inappropriate coupling should be removed.

------------------------------------------------------------------------

# 24. Security Boundary

Printful credentials must remain server-side.

Never expose:

``` text
PRINTFUL_TOKEN
```

through:

``` text
NEXT_PUBLIC_*
```

The preferred communication pattern is:

``` text
Browser
   |
   v
Storefront API
   |
   v
Server-Side Printful Client
   |
   v
Printful API
```

Not:

``` text
Browser
   |
   +-----------------------> Printful API
           secret token
```

This protects provider credentials and gives the storefront control over
validation, authorization, logging, rate limiting, and error handling.

------------------------------------------------------------------------

# 25. Mockup Persistence

Generated Printful mockups should not automatically be treated as
permanent storefront assets.

The architecture should support:

``` text
Printful Mockup
      |
      v
Temporary Provider URL
      |
      v
Storefront Storage
      |
      v
Permanent Product Asset
```

This ensures published product pages do not depend indefinitely on
temporary provider-generated URLs.

The actual storage provider should reuse the application's existing
storage infrastructure whenever practical.

------------------------------------------------------------------------

# 26. Asynchronous Mockup Generation

Mockup generation should be treated as a task.

Conceptually:

``` text
Storefront
    |
    | Create Mockup
    v
Printful
    |
    | task key
    v
PENDING
    |
    | processing
    v
COMPLETED
    |
    v
Mockup URLs
```

The application should not assume a mockup is immediately available.

This is why the initial integration includes:

-   task IDs/keys;
-   pending state;
-   polling or future webhook handling;
-   completed state;
-   failure handling; and
-   timeout protection.

------------------------------------------------------------------------

# 27. Recommended Separation of Concerns

The application should conceptually have four major domains.

## Commerce

Responsible for:

-   storefront products;
-   pricing;
-   collections;
-   cart;
-   checkout;
-   customer orders; and
-   publication.

## Design

Responsible for:

-   artwork;
-   placements;
-   design configurations;
-   personalization; and
-   mockup references.

## Provider

Responsible for:

-   Printful API communication;
-   catalog products;
-   provider variants;
-   production data;
-   mockup generation;
-   fulfillment; and
-   tracking.

## Administration

Responsible for:

-   selecting base products;
-   creating storefront products;
-   applying designs;
-   setting pricing;
-   generating mockups;
-   publishing products; and
-   monitoring provider synchronization.

Keeping these concerns separate makes the application easier to
maintain.

------------------------------------------------------------------------

# 28. Target Administrative Workflow

The eventual product-management workflow should be simple even though
the backend architecture is sophisticated.

``` text
1. Browse Printful Catalog
           |
           v
2. Choose Base Product
           |
           v
3. Choose Variants
           |
           v
4. Choose Existing Design
           |
           v
5. Choose Placement/Technique
           |
           v
6. Generate Mockups
           |
           v
7. Set Product Name/Description
           |
           v
8. Set Retail Price
           |
           v
9. Assign Category/Collection
           |
           v
10. Review
           |
           v
11. Publish
```

The administrator should not need to manually understand raw Printful
API payloads.

------------------------------------------------------------------------

# 29. Target Customer Workflow

The customer-facing workflow should remain conventional.

``` text
Browse Store
     |
     v
Select Product
     |
     v
Choose Color
     |
     v
Choose Size
     |
     v
Add to Cart
     |
     v
Checkout
     |
     v
Payment
     |
     v
Order Confirmation
```

The customer does not need to know that the product is internally
composed from:

``` text
Storefront Product
+
Printful Catalog Product
+
Printful Variant
+
Design
+
Placement
+
Generated Mockup
```

The complexity belongs behind the storefront.

------------------------------------------------------------------------

# 30. Architectural Rules for Future Coding Agents

Any AI coding agent or developer working on this repository should
follow these rules:

1.  Do not make Printful the storefront database.
2.  Do not use Printful product IDs as internal product primary keys.
3.  Do not use Printful variant IDs as internal variant primary keys.
4.  Keep provider-specific code isolated.
5.  Preserve storefront-owned pricing.
6.  Preserve storefront-owned SEO.
7.  Preserve storefront-owned product descriptions.
8.  Treat designs as reusable assets where practical.
9.  Do not automatically import and publish the entire Printful catalog.
10. Do not expose Printful credentials to the browser.
11. Do not hard-code one printing technique for all products.
12. Do not hard-code one print area for all products.
13. Use Printful's product and variant information for manufacturing
    capabilities.
14. Treat generated mockups as provider assets that may require
    persistence.
15. Keep customer orders in the storefront database.
16. Map provider orders to internal orders.
17. Do not remove working infrastructure simply because it is not needed
    by the first release.
18. Do remove obsolete provider-specific assumptions when they interfere
    with the target architecture.
19. Inspect the existing repository before creating migrations or
    replacing components.
20. Maintain a path toward provider-neutral commerce architecture.

------------------------------------------------------------------------

# 31. Immediate Development Direction

The immediate sequence should be:

``` text
CURRENT
Finish Printful integration prompt
        |
        v
Verify implementation report
        |
        v
Audit remaining Printify assumptions
        |
        v
PHASE 2
Build Storefront Product Catalog
        |
        v
Connect Storefront Products
to Printful Catalog Products
        |
        v
Create Provider Mappings
        |
        v
Add Catalog Administration
        |
        v
PHASE 3
Connect Designs + Mockup Generation
        |
        v
PHASE 4
Order Fulfillment
```

Do not begin a wholesale rewrite without first auditing the completed
Printful implementation.

------------------------------------------------------------------------

# 32. Definition of Success

The architecture is successful when the following statement is true:

> A storefront product can be created, priced, categorized, described,
> published, sold, and tracked by the storefront while using Printful
> only for the manufacturing capabilities that product requires.

A stronger future success condition is:

> The storefront can change or add a fulfillment provider without
> redesigning its entire product catalog or customer experience.

And the long-term automation objective is:

> The business can combine reusable designs, locations, Printful base
> products, variants, placements, and pricing rules to create large
> numbers of commercially distinct products without manually
> constructing every possible combination inside Printful.

------------------------------------------------------------------------

# 33. Final Architecture

The intended end-state is:

``` text
                         CUSTOMER
                            |
                            v
                     PUBLIC STOREFRONT
                            |
                            v
                     STOREFRONT CATALOG
                            |
          +-----------------+-----------------+
          |                 |                 |
       PRODUCTS          DESIGNS          VARIANTS
          |                 |                 |
          +-----------------+-----------------+
                            |
                            v
                     PROVIDER MAPPING
                            |
                            v
                    PRINTFUL SERVICE LAYER
                            |
       +--------------------+--------------------+
       |                    |                    |
    CATALOG              MOCKUPS              ORDERS
       |                    |                    |
       +--------------------+--------------------+
                            |
                            v
                         PRINTFUL
                            |
                   +--------+--------+
                   |                 |
              MANUFACTURING       SHIPPING
                   |                 |
                   +--------+--------+
                            |
                            v
                         CUSTOMER
```

This architecture allows the storefront to remain the center of the
business while Printful operates as a powerful production and
fulfillment service behind it.

------------------------------------------------------------------------

# 34. Summary

The Printful integration is not intended to turn the storefront into a
copy of a Printful store.

It is intended to provide a **manufacturing and fulfillment engine
behind an independent commerce platform**.

The major strategic separation is:

``` text
WHAT WE SELL
     =
STOREFRONT

WHAT CAN BE MANUFACTURED
     =
PRINTFUL

WHAT THE PRODUCT LOOKS LIKE
     =
DESIGN + MOCKUP SYSTEM

HOW THE CUSTOMER PAYS
     =
STOREFRONT CHECKOUT / PAYMENT SYSTEM

HOW THE PHYSICAL ITEM IS PRODUCED
     =
PRINTFUL

HOW THE BUSINESS RETAINS CONTROL
     =
INTERNAL CATALOG + PROVIDER ABSTRACTION
```

The current Mockup Generator work therefore remains valuable, but it
should become one capability inside a broader storefront-owned product
architecture.

The next major architectural milestone is the **Storefront Product
Catalog**, built on top of the Printful integration rather than
replacing it.
