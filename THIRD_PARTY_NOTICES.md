# Third-party notices

## DIFrauD email dataset

`data/emails.json` and the email text in recorded results are sampled from the
[DIFrauD phishing test split](https://huggingface.co/datasets/difraud/difraud).
The [upstream dataset card](https://huggingface.co/datasets/difraud/difraud#license)
declares MIT licensing. The upstream repository currently provides that declaration
but does not contain the `LICENSE.txt` referenced by its card. We preserve the source
and licensing declaration here rather than inventing an upstream copyright holder.
The app's copyright notice does not assert ownership of these emails.

Selection details and source checksum are in `data/provenance.json`; the reproduction
script is `scripts/sample-data.py`. Email text is unmodified and may contain personal
information, offensive content, and malicious links from the public corpus. The app
renders it as text and does not follow links or instructions in it.

The dataset builds on prior corpora documented in its card, including the work of
Victor Zeng, Xuting Liu, and Rakesh M. Verma, “Does Deception Leave a Content
Independent Stylistic Trace?” (CODASPY 2022), https://doi.org/10.1145/3508398.3519358.

## Dependencies and branding

Dependencies retain their respective licenses, available in the installed packages.
Together AI and Typesafe AI names and logos identify the services used by this demo;
the project MIT license does not grant trademark rights.
