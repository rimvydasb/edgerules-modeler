/** A small layered model: two input types with facts and an owner link, three decisions and a service. */
export const DRD_MODEL = `{
    type Applicant: { owner application: <Application>; name: <string>; birthYear: <number> }
    type Application: { year: <number>; amount: <number>; applicants: <Applicant[]> }
    type Unused: { note: <string> }
    facts ApplicantFacts(applicant: Applicant): {
        age: applicant.application.year - applicant.birthYear
    }
    decision ApplicantScore(applicant: Applicant): {
        score: applicant.age * 2
    }
    decision Eligibility(applicant: Applicant): {
        eligible: applicant.ApplicantScore.score > 40
    }
    decision Approval(application: Application): {
        approved: count(for applicant in application.applicants return applicant.Eligibility.eligible) > 0
        outcome: if approved and application.amount < 100000 then "APPROVE" else "REFER"
    }
    service approve(application: Application): {
        return: application.Approval.outcome
    }
}`;
