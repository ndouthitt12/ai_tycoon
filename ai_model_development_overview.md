# AI Model Development: Current System And Realism Roadmap

This document explains how AI model development currently works in the game and recommends changes to make it feel more realistic. The recommendations are ranked from critical to nice-to-have based on how much they would improve realism, strategic depth, and player decision quality.

## Current Model Development Flow

The current model development process is centered on the Lab screen and the training simulation in `src/game/systems/training.ts` and `src/game/sim.ts`.

At a high level, the player chooses what kind of model run to launch, configures architecture and goals, pays part of the development cost up front, waits through an active development period, reacts to events, and either ships a model or loses the run.

## 1. Run Type

The player can launch three types of model development:

- `New`: creates a new model family from scratch.
- `Upgrade`: improves an existing model and keeps the same family.
- `Branch`: starts from an existing model but creates a new family branch.

Upgrade and branch runs inherit the base model's architecture, including memory size, parameter scale, context window, data units, and current capability baseline. New runs use the selected model size as the architectural baseline.

This is a good foundation. It already captures one important real-world pattern: most AI companies do not train every model from nothing. They iterate from previous checkpoints, specialize existing models, and create product-specific branches.

## 2. Model Size, Data Tier, And Data Volume

The player chooses a model size:

- Small
- Medium
- Large
- Frontier

Model size sets baseline capability, inference cost, failure risk, base work, and the allowed compute range.

The player also chooses a data tier:

- Web
- Licensed
- Synthesized

Data tier affects capability, trust, cost, and failure risk. The player must own enough data inventory for the selected data tier, and the training data volume slider determines how many data units the run consumes. More data increases capability, cost, duration, parameter capacity, and failure risk.

This already creates a useful tradeoff: more data is not simply free capability. It creates larger projects that are harder and more expensive to execute.

## 3. Architecture Configuration

Each model has three architecture fields:

- Memory size
- Parameter scale
- Context window

For new models, these start from the selected model size. For upgrades and branches, they start from the base model. The player can expand them within limits.

Architecture changes affect:

- Capability
- Inference cost
- Development duration
- Failure risk
- Development cost
- Trust

The current abstraction is playable and understandable, but it compresses many real model-design choices into three visible numbers. In real AI development, "parameters" alone is a weak proxy for model quality. Dataset quality, training recipe, architecture family, post-training, eval selection, inference optimization, and product fit often matter more.

## 4. Model Goals

The player can assign weights to model goals:

- Speed
- Accuracy
- Reasoning
- Agentic
- Coding
- Multimodal
- Creativity
- Alignment
- Multilingual
- Recall
- Compression

Higher goal weights increase capability through a goal-complexity lift, but they also increase cost, duration, and failure risk. Different goals matter to different market cohorts later through the market simulation.

This is one of the strongest parts of the current design. It correctly pushes the player away from thinking of model quality as one generic score. A coding-heavy model, a consumer-chat model, and an enterprise-safe model should not all be identical except for size.

## 5. Reliability Investment

The player can invest in reliability tiers:

- Syntax & Extraction
- Semantic Generation
- Analytical Reasoning
- Complex Synthesis
- Bounded Agency
- Autonomous Workflow
- Frontier Reasoning

Reliability investment increases projected development cost sharply as the slider approaches high values. The cost curve uses base constants and exponents, so high-end reliability becomes extremely expensive.

This is directionally realistic. It models the idea that getting from "pretty good" to "trusted for hard tasks" is much more expensive than getting from "bad" to "usable."

The main current weakness is that reliability is mostly a purchased attribute. It is not yet deeply tied to eval failures, incidents, red-teaming, customer trust, deployment gating, or the difference between lab performance and product performance.

## 6. Researchers, Engineers, And Departments

The current system has both broad headcount and named employees.

Researcher headcount contributes to capability and reduces expected cost through a random per-researcher discount. Named researchers can be assigned to runs. Their skill, specialty, burnout, leadership level, poach risk, and breakthrough chance influence the run.

Assigned researchers currently affect:

- Research contribution
- Key-person risk
- Failure risk
- Specialty-specific capability at completion
- Talent events

Engineers affect:

- Failure-risk reduction
- Training duration reduction
- Trust
- Inference cost
- Reliability training effectiveness

Departments also contribute through morale and management quality.

This is a strong realism feature. It makes model development feel like an organization, not just a shopping cart. The named researcher layer is especially useful because real AI labs are fragile around a small number of high-leverage people.

## 7. Cost And Payment Timing

When a run launches, the player pays 30% of the projected equivalent development cost up front. The remaining cost is deducted monthly over the development period.

Projected equivalent cost is built from:

- Compute need
- Development duration
- Data purchase cost
- Parameter expansion
- Memory expansion
- Context expansion
- Goal development cost
- Reliability cost
- Researcher cost discount

This is more realistic than charging the whole project instantly. It creates runway pressure during development and makes long-running projects financially dangerous.

## 8. Active Runs, Compute Allocation, And Failure

The game allows up to three active runs. Each active run consumes training compute. The player controls what percentage of reserved cloud pods are allocated to training versus serving.

If training demand exceeds allocated training pods, the run faces training overflow pressure. When a run completes, the final failure roll includes:

- Base failure risk
- Run event modifiers
- Training pressure
- Serving pressure
- Frontier research directive penalty

If the run fails, the money is spent and no model ships. Assigned researchers are released but gain burnout.

This is a good macro-level abstraction. The player feels that frontier development can destroy capital. The main missing piece is that failure is binary. Real development usually has partial failures: underperforming checkpoints, schedule slips, downgraded launches, expensive salvage, or post-training rescue.

## 9. Mid-Run Events

Training runs can trigger intervention events around the middle of development:

- Loss spike
- Data pipeline glitch
- Spot compute window

Named researchers can also trigger talent events:

- Competing offer
- Breakthrough
- Burnout

Event choices change cash, risk, capability, trust, duration, compute need, employee loyalty, morale, and employee status.

This is one of the best pieces of the current loop. It gives development runs narrative texture and makes model training feel unstable. The strongest improvement would be to make these events less random and more causally tied to the player's choices.

## 10. Completion And Shipped Model State

When a run succeeds, the game creates a `ModelState` with:

- Model family
- Base model reference
- Name and version
- Development cost
- Capability
- Inference cost
- Trust
- Memory size
- Parameter scale
- Context window
- Goals
- Training data units
- Release month
- Size
- Data tier
- Cohort subscriber map
- Reliability profile

Capability is a single public score. It influences market comparison, board pressure, and customer choice. Goal weights and reliability also matter in market behavior.

The biggest realism gap is that the game currently treats internal model quality, public benchmark standing, and market perception as mostly the same thing. Real AI markets are much messier: companies can overclaim, underclaim, benchmark-shop, hide weaknesses, delay releases, run private evals, and slowly earn or lose trust through product usage.

## 11. Competitor Development

Competitors have cash, revenue, profit history, release cadence, strategies, model goals, and release types. They can launch new models, upgrades, and branches. Competitor releases are budget-limited and deduct from cash.

Competitor models have capability, goals, architecture, development cost, release month, prices, subscribers, and reliability.

This gives the market an active race dynamic. The current limitation is that competitors do not appear to suffer the same visible development uncertainty as the player. They produce releases from budget formulas instead of going through exposed active runs, mid-run failures, talent constraints, eval choices, or deployment incidents.

## Critical Adjustments

These changes would most improve realism and should be prioritized first.

### 1. Split True Capability, Demonstrated Capability, And Market Trust

Currently, `capability` does too much. It acts like internal model quality, benchmark score, public perception, and competitive standing.

Recommended change:

- Add `trueCapability`: hidden internal model quality.
- Add `demonstratedCapability`: what the market believes from benchmarks, evals, demos, and observed product quality.
- Keep `trust` as confidence that the model behaves safely and reliably in real usage.

- Implement third party benchmark companies.
  - Before launch, you can send your model to be tested against these third party benchmarks, receive a score, and that'll be used to determine your demonstrated capability.

Why it matters:

Real AI companies do not automatically get credit for capability. They must prove it through benchmarks, product launches, enterprise pilots, customer usage, third-party evals, and reputation. A model can be strong but poorly demonstrated, overhyped but weak, or excellent in one area and unimpressive in another.

Gameplay impact:

This creates a new strategic layer after training: publish bold benchmarks, run conservative evals, launch private beta, delay for safety work, or overclaim and risk trust damage.

### 2. Replace The Single Capability Score With A Capability Profile

The game already has model goals, but final model quality still collapses heavily into one number.

Recommended change:

- Store capability by domain: reasoning, coding, speed, multimodal, factuality, tool use, long-context, safety, multilingual, and cost efficiency.
- Use overall capability only as a summary, not the source of truth.
- Let market cohorts and benchmarks read from the domain profile.

Why it matters:

Modern AI models are not universally better or worse. A model can be great at coding and weak at multilingual support, fast but shallow, safe but refusal-heavy, cheap but less capable, or excellent at long-context retrieval but mediocre at agentic tasks.

Gameplay impact:

This makes specialized model branches much more meaningful. The player can build a developer model, enterprise model, consumer model, medical model, or low-cost API model without everything reducing to one leaderboard number.

### 3. Add Post-Training As A Separate Phase

Right now, training and alignment/reliability are mostly configured before launch and resolved together.

Recommended change:

- Split development into pretraining, post-training, evaluation, and launch readiness.
- Let post-training improve instruction following, safety, coding, agent behavior, tool use, and product fit.
- Make post-training cheaper than pretraining but highly dependent on talent and data quality.

Why it matters:

In real AI development, base-model training is only part of the process. Post-training, RLHF/RLAIF, synthetic data, tool-use tuning, red-teaming, and eval iteration often determine whether a model feels good in product.

Gameplay impact:

This creates more decisions after a base run completes. A player could ship early with weak polish, spend more to improve reliability, specialize for a customer segment, or rescue an underwhelming base model.

### 4. Replace Binary Training Failure With Outcome Bands

Currently, a run mostly succeeds or fails.

Recommended change:

- Add outcome bands: failed, salvaged checkpoint, underperformed, met target, exceeded target, breakthrough.
- Failed runs should sometimes leave reusable artifacts, lessons, partial checkpoints, or data-cleaning improvements.
- Underperforming models should still be launchable, but with weaker trust, capability, or economics.

Why it matters:

AI development rarely ends with a clean yes/no. Many runs produce disappointing but usable checkpoints. Teams often recover value through distillation, fine-tuning, smaller releases, internal tooling, or research lessons.

Gameplay impact:

This makes expensive misses less arbitrary and gives the player interesting recovery decisions.

### 5. Make Data Quality More Granular

Data currently has broad tiers and volume units.

Recommended change:

- Track data by source and coverage: web, licensed text, code, scientific, legal, medical, multilingual, image/video/audio, user feedback, synthetic, proprietary customer data.
- Add contamination, duplication, freshness, legal risk, and domain coverage.
- Let data quality affect specific model domains instead of only broad capability/trust.

Why it matters:

Data is not just "more units." The composition and cleanliness of data strongly shape model behavior. A coding model needs code data. A medical model needs high-trust medical data. Multilingual quality requires coverage across languages, not generic volume.

Gameplay impact:

This would make dataset purchasing and data strategy much more meaningful.

## High Priority Adjustments

These changes are slightly less foundational than the critical items, but they would greatly improve realism.

### 6. Add Evaluation Strategy

Recommended change:

- Add internal evals, public benchmarks, customer pilots, red-team reports, and live product telemetry.
- Let the player decide which evals to run and which results to publish.
- Make evals cost time and money.
- Make benchmark over-optimization possible.

Why it matters:

AI companies compete through eval narratives as much as raw capability. Benchmark selection can flatter or expose a model.

Gameplay impact:

This turns launch into a strategic communication decision, not just the moment the training bar ends.

### 7. Tie Researcher Specialties To Specific Model Outcomes

Named researchers already have specialties, but the effects could become more precise.

Recommended change:

- Reasoning researchers improve reasoning, coding, agentic planning, and hard eval performance.
- Data researchers improve data quality, reduce contamination, and improve domain coverage.
- Safety researchers improve reliability, reduce incidents, and improve enterprise adoption.
- Inference researchers reduce latency, serving cost, and capacity pressure.
- Multimodal researchers improve image/video/file capability.

Why it matters:

Real AI labs are not interchangeable headcount pools. A small number of specialists can change the result of a model line.

Gameplay impact:

This makes hiring and assignment decisions easier to understand and more strategically important.

### 8. Add Productization And Deployment Gating

Recommended change:

- Separate "model trained" from "model ready to serve."
- Add deployment steps: inference optimization, safety review, product integration, rate-limit planning, enterprise compliance, and launch ramp.
- Allow soft launches, private betas, and phased rollout.

Why it matters:

A trained model is not automatically a product. Serving reliability, latency, safety, and cost determine whether the company can actually monetize it.

Gameplay impact:

This would connect the Lab, Compute, Market, and Strategy screens more tightly.

### 9. Make Inference Economics A First-Class Model Attribute

The current system has inference cost and serving pressure, but model development could shape serving economics more directly.

Recommended change:

- Track latency, throughput, context cost, cacheability, batchability, memory footprint, and routing suitability.
- Let speed/compression/inference research improve serving margin.
- Let high-context and agentic models create more expensive traffic patterns.

Why it matters:

Real AI companies can lose money on popular models if inference costs are too high. Product success can become an infrastructure crisis.

Gameplay impact:

This makes "best model" and "best business" diverge in interesting ways.

### 10. Add Compute Procurement Constraints To Training

The player already manages reserved pods and training allocation, but the run itself abstracts cluster quality.

Recommended change:

- Add cluster reliability, hardware generation, interconnect quality, reservation lead time, cloud vendor limits, and datacenter ramp.
- Let large runs require contiguous training clusters.
- Add schedule risk from hardware availability.

Why it matters:

Frontier model development is constrained by hardware access and cluster reliability, not just monthly spend.

Gameplay impact:

This turns compute planning into a strategic bottleneck instead of a mostly linear capacity slider.

## Medium Priority Adjustments

These would add realism and texture after the core model-development loop is stronger.

### 11. Make Competitors Use A Similar Development Pipeline

Recommended change:

- Give competitors visible active runs, release rumors, failures, talent losses, funding constraints, and launch delays.
- Let the player infer competitor progress imperfectly.

Why it matters:

Competitors currently launch through formulas. The market would feel more alive if rivals had uncertainty and visible strategic posture.

Gameplay impact:

This creates anticipation and counterplay instead of surprise-only releases.

### 12. Add Model Lineage Benefits And Technical Debt

Recommended change:

- Track family-level architecture maturity.
- Let repeated upgrades improve efficiency but also accumulate technical debt.
- Make branches easier to specialize but harder to keep synced with frontier improvements.

Why it matters:

Real model families have accumulated tooling, recipes, eval knowledge, and deployment infrastructure. But old assumptions can become constraints.

Gameplay impact:

This makes "upgrade the flagship" versus "start a new family" a richer decision.

### 13. Add Regulatory And Legal Data Risk

Recommended change:

- Make data choices create legal exposure, copyright risk, privacy risk, or regional restrictions.
- Let licensed data reduce risk but cost more.
- Let web or scraped data create cheaper capability with future downside.

Why it matters:

AI model development is increasingly shaped by legal and regulatory constraints.

Gameplay impact:

This makes data strategy less one-dimensional.

### 14. Add Safety Incidents And Real-World Feedback Loops

Recommended change:

- Let deployed models generate incidents based on reliability, trust, capability profile, customer mix, and launch pressure.
- Incidents should affect trust, churn, enterprise adoption, regulators, and board pressure.

Why it matters:

AI model quality is proven after deployment, not only in the lab.

Gameplay impact:

This makes launch timing and safety investment matter after the model ships.

### 15. Add Model Deprecation And Maintenance

Recommended change:

- Require ongoing maintenance for live models.
- Let old models become cheaper but less attractive.
- Add security patches, eval refreshes, fine-tune maintenance, and customer migration.

Why it matters:

AI companies operate model portfolios. Old models do not vanish; they create support burden and customer migration problems.

Gameplay impact:

This supports the existing desire for multiple active models and model-specific pricing.

## Nice-To-Have Adjustments

These are valuable, but they should come after the core realism gaps are addressed.

### 16. Add Research Programs Before Training Runs

Recommended change:

- Let players fund research programs such as new architecture, better tokenization, synthetic data, alignment methods, retrieval, agents, inference optimization, or multimodal encoders.
- Successful research programs unlock bonuses or reduce risk in later runs.

Why it matters:

Frontier labs do not only launch huge training runs. They run many experiments to discover recipes before committing the full cluster.

Gameplay impact:

This would create a longer strategic arc before major model bets.

### 17. Add Experiment Runs And Scaling-Law Forecasts

Recommended change:

- Let players run small experiments to estimate whether a larger run will scale well.
- Show forecast uncertainty instead of exact projected capability.

Why it matters:

Real AI development uses smaller runs to predict larger-run behavior, but forecasts are uncertain.

Gameplay impact:

This makes big runs feel like bets under uncertainty instead of exact spreadsheet outputs.

### 18. Add Model Cards And Launch Packaging

Recommended change:

- Generate a model card for each launch: strengths, weaknesses, intended use, safety notes, benchmark claims, pricing, and deployment posture.
- Let model cards influence enterprise trust and customer adoption.

Why it matters:

Real AI model releases are packaged through documentation, evals, pricing, access tiers, and safety claims.

Gameplay impact:

This adds flavor and clarity to each model release.

### 19. Add Customer Fine-Tuning And Private Deployments

Recommended change:

- Let enterprise customers request custom fine-tunes or private deployments.
- Custom work should generate revenue but consume engineers, researchers, compute, and support.

Why it matters:

Enterprise AI revenue often depends on adaptation, compliance, and deployment support.

Gameplay impact:

This gives enterprise strategy more depth.

### 20. Add Open-Source Release Strategy

Recommended change:

- Let the player open-source old or specialized models.
- Open-source releases can increase developer distribution, reduce pricing power, invite commoditization, or improve hiring.

Why it matters:

Open models shape the AI market and change the economics of proprietary model companies.

Gameplay impact:

This creates a strategic tradeoff between ecosystem power and direct monetization.

## Recommended Implementation Order

The best order is:

1. Split `capability` into true, demonstrated, and market-facing values.
2. Add a model capability profile and make goals produce domain-specific strengths.
3. Add post-training as a separate step before launch.
4. Replace binary failure with outcome bands.
5. Expand data from tier plus units into domain coverage and quality.
6. Add eval strategy and benchmark publication choices.
7. Tie researcher specialties more tightly to domain outcomes.
8. Add deployment readiness and inference optimization.
9. Improve competitor development visibility.
10. Add maintenance, incidents, and model lifecycle management.

## Short Version

The current system already has a strong base: model size, data tier, architecture, goals, reliability, named researchers, costs over time, training events, failure risk, compute pressure, market comparison, and competitor launches.

The biggest realism issue is that the game still treats model development as producing one mostly knowable capability number. The most important next step is to make model quality multidimensional and uncertain: hidden true capability, public demonstrated capability, domain-specific strengths, eval strategy, post-training, launch readiness, and product feedback.

Once those pieces exist, the rest of the game can become much more realistic without becoming confusing: data choices matter more, researchers matter more, competitors feel more alive, and the player has to manage not just "Can we train the biggest model?" but "Can we prove, launch, serve, and monetize the right model at the right time?"
